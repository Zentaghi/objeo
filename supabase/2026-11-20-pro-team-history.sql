-- Objeo Pro: team membership, owner-only invitations, and immutable return history.
-- Execute after professional-establishments.sql.
create table if not exists public.objeo_pro_team (
 establishment_id uuid not null references public.objeo_establishments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 added_at timestamptz not null default now(),
 primary key(establishment_id,user_id)
);
alter table public.objeo_pro_team enable row level security;
revoke all on public.objeo_pro_team from anon,authenticated;
grant select on public.objeo_pro_team to authenticated;
drop policy if exists "pro team members read membership" on public.objeo_pro_team;
create policy "pro team members read membership" on public.objeo_pro_team
for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.objeo_establishments e where e.id=establishment_id and e.owner_id=(select auth.uid()))
);
create or replace function public.objeo_pro_add_member(p_establishment_id uuid,p_email text)
returns text language plpgsql security definer set search_path=''
as $$
declare v_uid uuid;
begin
 if not exists(select 1 from public.objeo_establishments e where e.id=p_establishment_id and e.owner_id=(select auth.uid())) then raise exception 'Accès réservé au responsable'; end if;
 if length(trim(p_email))>254 or trim(p_email)='' then raise exception 'Adresse invalide'; end if;
 select id into v_uid from auth.users where lower(email)=lower(trim(p_email)) limit 1;
 if v_uid is null then raise exception 'Ce compte doit d''abord être créé sur Objeo'; end if;
 if v_uid=(select auth.uid()) then raise exception 'Vous êtes déjà responsable'; end if;
 insert into public.objeo_pro_team(establishment_id,user_id) values(p_establishment_id,v_uid) on conflict do nothing;
 return 'added';
end $$;
revoke all on function public.objeo_pro_add_member(uuid,text) from public,anon;
grant execute on function public.objeo_pro_add_member(uuid,text) to authenticated;

create or replace function public.objeo_pro_remove_member(p_establishment_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if not exists(select 1 from public.objeo_establishments e where e.id=p_establishment_id and e.owner_id=(select auth.uid())) then raise exception 'Accès réservé au responsable'; end if;
 delete from public.objeo_pro_team where establishment_id=p_establishment_id and user_id=p_user_id;
end $$;
revoke all on function public.objeo_pro_remove_member(uuid,uuid) from public,anon;
grant execute on function public.objeo_pro_remove_member(uuid,uuid) to authenticated;

-- Staff can publish and edit objects but cannot edit establishment profile.
drop policy if exists "pro team reads establishment items" on public.objeo_establishment_items;
create policy "pro team reads establishment items" on public.objeo_establishment_items
for select to authenticated using(exists(select 1 from public.objeo_pro_team t where t.establishment_id=public.objeo_establishment_items.establishment_id and t.user_id=(select auth.uid())));
drop policy if exists "pro team inserts establishment items" on public.objeo_establishment_items;
create policy "pro team inserts establishment items" on public.objeo_establishment_items
for insert to authenticated with check(exists(select 1 from public.objeo_pro_team t where t.establishment_id=public.objeo_establishment_items.establishment_id and t.user_id=(select auth.uid())));
drop policy if exists "pro team updates establishment items" on public.objeo_establishment_items;
create policy "pro team updates establishment items" on public.objeo_establishment_items
for update to authenticated using(exists(select 1 from public.objeo_pro_team t where t.establishment_id=public.objeo_establishment_items.establishment_id and t.user_id=(select auth.uid())))
with check(exists(select 1 from public.objeo_pro_team t where t.establishment_id=public.objeo_establishment_items.establishment_id and t.user_id=(select auth.uid())));

create table if not exists public.objeo_pro_return_events (
 id uuid primary key default gen_random_uuid(),
 establishment_id uuid not null references public.objeo_establishments(id) on delete cascade,
 item_id uuid not null unique references public.objeo_establishment_items(id) on delete cascade,
 item_title text not null,
 item_kind text not null,
 confirmed_by uuid references auth.users(id) on delete set null,
 confirmed_at timestamptz not null default now()
);
alter table public.objeo_pro_return_events enable row level security;
revoke all on public.objeo_pro_return_events from anon,authenticated;
grant select on public.objeo_pro_return_events to authenticated;
drop policy if exists "pro team and owner read return history" on public.objeo_pro_return_events;
create policy "pro team and owner read return history" on public.objeo_pro_return_events for select to authenticated
using(exists(select 1 from public.objeo_establishments e where e.id=establishment_id and (e.owner_id=(select auth.uid()) or exists(select 1 from public.objeo_pro_team t where t.establishment_id=e.id and t.user_id=(select auth.uid())))));

create or replace function public.objeo_pro_audit_returns()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if old.status='open' and new.status='returned' then
   insert into public.objeo_pro_return_events(establishment_id,item_id,item_title,item_kind,confirmed_by)
   values(new.establishment_id,new.id,new.title,new.kind,(select auth.uid()))
   on conflict(item_id) do nothing;
 end if;
 return new;
end $$;
drop trigger if exists objeo_pro_return_audit on public.objeo_establishment_items;
create trigger objeo_pro_return_audit after update of status on public.objeo_establishment_items
for each row execute function public.objeo_pro_audit_returns();
-- For older finished entries the exact closing time and actor are unknown.
insert into public.objeo_pro_return_events(establishment_id,item_id,item_title,item_kind,confirmed_by,confirmed_at)
select i.establishment_id,i.id,i.title,i.kind,null,i.created_at
from public.objeo_establishment_items i where i.status='returned'
on conflict(item_id) do nothing;
-- Finished items may never be reopened or silently edited.
create or replace function public.objeo_pro_protect_closed_items()
returns trigger language plpgsql set search_path=''
as $$
begin
 if old.status='returned' then raise exception 'Une annonce terminée ne peut pas être modifiée'; end if;
 if old.establishment_id<>new.establishment_id then raise exception 'Changement d’établissement interdit'; end if;
 return new;
end $$;
drop trigger if exists objeo_pro_protect_closed on public.objeo_establishment_items;
create trigger objeo_pro_protect_closed before update on public.objeo_establishment_items
for each row execute function public.objeo_pro_protect_closed_items();


-- Hide completed listings from anonymous visitors, while preserving team history.
drop policy if exists "public read establishment items" on public.objeo_establishment_items;
create policy "public read establishment items" on public.objeo_establishment_items
for select using(status='open');
drop policy if exists "pro owner reads all items" on public.objeo_establishment_items;
create policy "pro owner reads all items" on public.objeo_establishment_items
for select to authenticated using(exists(
 select 1 from public.objeo_establishments e
 where e.id=public.objeo_establishment_items.establishment_id
 and e.owner_id=(select auth.uid())
));
