-- Objeo private inventory watch. Run after private-saved-objects.sql.
-- Notifications are suggestions, not proof of ownership.
create table if not exists public.objeo_saved_object_matches (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 saved_object_id uuid not null references public.objeo_saved_objects(id) on delete cascade,
 found_ad_id uuid not null references public.ads(id) on delete cascade,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(saved_object_id,found_ad_id)
);
create index if not exists objeo_saved_matches_owner_idx on public.objeo_saved_object_matches(owner_id,created_at desc);
alter table public.objeo_saved_object_matches enable row level security;
revoke all on public.objeo_saved_object_matches from anon;
grant select,update on public.objeo_saved_object_matches to authenticated;
drop policy if exists "saved_matches_select_own" on public.objeo_saved_object_matches;
create policy "saved_matches_select_own" on public.objeo_saved_object_matches for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "saved_matches_read_own" on public.objeo_saved_object_matches;
create policy "saved_matches_read_own" on public.objeo_saved_object_matches for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));

-- Only compare public ads with private inventory inside a SECURITY DEFINER trigger.
-- Never send private object title/photo/description to the finder.
create or replace function public.objeo_watch_saved_objects()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
 if new.kind is distinct from 'found' or new.status is distinct from 'open' then return new; end if;
 insert into public.objeo_saved_object_matches(owner_id,saved_object_id,found_ad_id)
 select s.owner_id,s.id,new.id
 from public.objeo_saved_objects s
 where s.owner_id<>new.user_id
   and length(trim(coalesce(s.city,'')))>0
   and lower(trim(s.city))=lower(trim(coalesce(new.city,'')))
   and (
     -- Strong textual signal: at least one distinctive title word of 4+ chars.
     exists (
       select 1 from regexp_split_to_table(lower(trim(s.title)), '[^[:alnum:]]+') as word
       where length(word)>=4
         and word not in ('avec','pour','dans','noir','noire','blanc','blanche','petit','petite','grand','grande','objet')
         and lower(coalesce(new.title,'')||' '||coalesce(new.description,'')) like '%'||word||'%'
     )
   )
 on conflict(saved_object_id,found_ad_id) do nothing;
 return new;
end $$;
drop trigger if exists objeo_watch_new_found_ad on public.ads;
create trigger objeo_watch_new_found_ad after insert on public.ads for each row execute function public.objeo_watch_saved_objects();
-- Existing ads can be evaluated separately after a user opts in; this trigger watches future ads only.
