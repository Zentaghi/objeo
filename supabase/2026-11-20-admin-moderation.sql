-- Objeo admin moderation: execute in Supabase SQL Editor.
-- IMPORTANT: after running, grant your own account access with:
-- insert into public.objeo_admins(user_id)
-- select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
-- on conflict do nothing;
-- Never put the admin email or service-role key in frontend code.
create table if not exists public.objeo_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.objeo_admins enable row level security;
revoke all on public.objeo_admins from anon, authenticated;

create table if not exists public.objeo_moderation_audit (
 id bigint generated always as identity primary key,
 admin_id uuid not null references auth.users(id),
 action text not null,
 target_id text not null,
 note text,
 created_at timestamptz not null default now()
);
alter table public.objeo_moderation_audit enable row level security;
revoke all on public.objeo_moderation_audit from anon, authenticated;

create table if not exists public.objeo_user_suspensions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 suspended_at timestamptz not null default now(),
 admin_id uuid not null references auth.users(id),
 reason text
);
alter table public.objeo_user_suspensions enable row level security;
revoke all on public.objeo_user_suspensions from anon, authenticated;

create or replace function public.objeo_admin_dashboard()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare result jsonb;
begin
 if not exists(select 1 from public.objeo_admins where user_id=(select auth.uid())) then
   raise exception 'Accès administrateur refusé' using errcode='42501';
 end if;
 select jsonb_build_object(
   'users',(select count(*) from auth.users),
   'ads',(select count(*) from public.ads),
   'pending_reports',(select count(*) from public.objeo_reports where status='pending'),
   'claims',(select count(*) from public.objeo_claims),
   'accepted_claims',(select count(*) from public.objeo_claims where status='accepted'),
   'suspended_users',(select count(*) from public.objeo_user_suspensions),
   'reports',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
      (select r.id,r.ad_id,r.reason,r.details,r.status,r.created_at,a.title as ad_title
       from public.objeo_reports r left join public.ads a on a.id=r.ad_id
       order by r.created_at desc limit 100) x),'[]'::jsonb),
   'ads_list',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
      (select a.id,a.title,a.kind,a.city,a.created_at,a.user_id,
       exists(select 1 from public.objeo_user_suspensions s where s.user_id=a.user_id) as suspended
       from public.ads a order by a.created_at desc limit 150) x),'[]'::jsonb),
   'audit',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
      (select id,action,target_id,note,created_at from public.objeo_moderation_audit
       order by created_at desc limit 40) x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.objeo_admin_dashboard() from public, anon;
grant execute on function public.objeo_admin_dashboard() to authenticated;

create or replace function public.objeo_admin_moderate(p_action text,p_target uuid,p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_owner uuid;
begin
 if not exists(select 1 from public.objeo_admins where user_id=(select auth.uid())) then
   raise exception 'Accès administrateur refusé' using errcode='42501';
 end if;
 if p_action='dismiss_report' then
   update public.objeo_reports set status='dismissed' where id=p_target and status='pending';
   if not found then raise exception 'Signalement introuvable ou déjà traité'; end if;
 elsif p_action='review_report' then
   update public.objeo_reports set status='reviewed' where id=p_target and status='pending';
   if not found then raise exception 'Signalement introuvable ou déjà traité'; end if;
 elsif p_action='delete_ad' then
   delete from public.ads where id=p_target;
   if not found then raise exception 'Annonce introuvable'; end if;
 elsif p_action='suspend_user' then
   if p_target=(select auth.uid()) or exists(select 1 from public.objeo_admins where user_id=p_target) then
     raise exception 'Suspension interdite pour cet administrateur';
   end if;
   insert into public.objeo_user_suspensions(user_id,admin_id,reason)
   values(p_target,(select auth.uid()),left(p_note,500))
   on conflict(user_id) do update set suspended_at=now(),admin_id=excluded.admin_id,reason=excluded.reason;
 elsif p_action='unsuspend_user' then
   delete from public.objeo_user_suspensions where user_id=p_target;
   if not found then raise exception 'Suspension introuvable'; end if;
 else
   raise exception 'Action inconnue';
 end if;
 insert into public.objeo_moderation_audit(admin_id,action,target_id,note)
 values((select auth.uid()),p_action,p_target::text,left(p_note,500));
end $$;
revoke all on function public.objeo_admin_moderate(text,uuid,text) from public, anon;
grant execute on function public.objeo_admin_moderate(text,uuid,text) to authenticated;

-- Block suspended users from creating new ads/reports/claims.
-- This does not disable login or every other legacy feature.
drop policy if exists "objeo suspension prevents ads" on public.ads;
create policy "objeo suspension prevents ads" on public.ads
as restrictive for insert to authenticated
with check(not exists(select 1 from public.objeo_user_suspensions s where s.user_id=(select auth.uid())));
-- Suspension enforcement via a security-definer helper (RLS-safe).
create or replace function public.objeo_is_not_suspended()
returns boolean language sql stable security definer set search_path = ''
as $$ select not exists(select 1 from public.objeo_user_suspensions where user_id=(select auth.uid())); $$;
revoke all on function public.objeo_is_not_suspended() from public, anon;
grant execute on function public.objeo_is_not_suspended() to authenticated;
drop policy if exists "objeo suspension prevents ads" on public.ads;
create policy "objeo suspension prevents ads" on public.ads as restrictive
for insert to authenticated with check(public.objeo_is_not_suspended());
drop policy if exists "objeo suspension prevents reports" on public.objeo_reports;
create policy "objeo suspension prevents reports" on public.objeo_reports as restrictive
for insert to authenticated with check(public.objeo_is_not_suspended());
drop policy if exists "objeo suspension prevents claims" on public.objeo_claims;
create policy "objeo suspension prevents claims" on public.objeo_claims as restrictive
for insert to authenticated with check(public.objeo_is_not_suspended());
