-- Objeo moderation v2. Execute AFTER 2026-11-20-admin-moderation.sql.
-- Private admin actions only. Never embed service_role keys in browser.
create index if not exists objeo_reports_queue_idx on public.objeo_reports(status,created_at desc);
create index if not exists objeo_ads_moderation_idx on public.ads(created_at desc);

create or replace function public.objeo_admin_dashboard()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.objeo_admins where user_id=(select auth.uid())) then
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
  (select r.id,r.ad_id,r.reporter_id,r.reason,r.details,r.status,r.created_at,
   a.title as ad_title,a.user_id as ad_owner_id,
   (select count(*) from public.objeo_reports rr where rr.ad_id=r.ad_id) as total_reports
   from public.objeo_reports r left join public.ads a on a.id=r.ad_id
   order by (r.status='pending') desc,r.created_at desc limit 300) x),'[]'::jsonb),
 'ads_list',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
  (select a.id,a.title,a.kind,a.city,a.created_at,a.user_id,
   exists(select 1 from public.objeo_user_suspensions s where s.user_id=a.user_id) as suspended,
   (select count(*) from public.objeo_reports r where r.ad_id=a.id) as report_count
   from public.ads a order by a.created_at desc limit 300) x),'[]'::jsonb),
 'suspensions',coalesce((select jsonb_agg(to_jsonb(x) order by x.suspended_at desc) from
  (select s.user_id,s.reason,s.suspended_at from public.objeo_user_suspensions s order by s.suspended_at desc limit 150) x),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from
  (select id,admin_id,action,target_id,note,created_at from public.objeo_moderation_audit order by created_at desc limit 100) x),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.objeo_admin_dashboard() from public, anon;
grant execute on function public.objeo_admin_dashboard() to authenticated;

-- Record a single decision on the report, and optionally delete its associated ad.
-- Deletes are permanent; dependent claims/notifications can cascade.
create or replace function public.objeo_admin_resolve_report(
 p_report_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_ad uuid; v_owner uuid; v_status text;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.objeo_admins where user_id=(select auth.uid())) then
  raise exception 'Accès administrateur refusé' using errcode='42501';
 end if;
 if p_decision not in ('dismiss','review','delete_ad') then raise exception 'Décision invalide'; end if;
 select r.ad_id,r.status into v_ad,v_status from public.objeo_reports r where r.id=p_report_id for update;
 if not found then raise exception 'Signalement introuvable'; end if;
 if v_status<>'pending' then raise exception 'Signalement déjà traité'; end if;
 if p_decision='delete_ad' then
   -- Preserve audit BEFORE deleting cascading reports.
   insert into public.objeo_moderation_audit(admin_id,action,target_id,note)
   values((select auth.uid()),'delete_ad_from_report',v_ad::text,left(p_note,500));
   delete from public.ads where id=v_ad;
 else
   update public.objeo_reports set status=case when p_decision='dismiss' then 'dismissed' else 'reviewed' end
   where id=p_report_id;
   insert into public.objeo_moderation_audit(admin_id,action,target_id,note)
   values((select auth.uid()),case when p_decision='dismiss' then 'dismiss_report' else 'review_report' end,p_report_id::text,left(p_note,500));
 end if;
end $$;
revoke all on function public.objeo_admin_resolve_report(uuid,text,text) from public, anon;
grant execute on function public.objeo_admin_resolve_report(uuid,text,text) to authenticated;

-- Prevent suspended accounts from updating existing ads as well as creating new ones.
drop policy if exists "objeo suspension prevents ad updates" on public.ads;
create policy "objeo suspension prevents ad updates" on public.ads as restrictive
for update to authenticated using(public.objeo_is_not_suspended())
with check(public.objeo_is_not_suspended());
