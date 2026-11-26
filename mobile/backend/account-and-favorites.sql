-- Additive tables for native clients; no access to other users' favorites or deletion requests.
begin;
create table if not exists public.objeo_favorites (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 ad_id uuid not null,
 is_pro boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(user_id, ad_id, is_pro)
);
alter table public.objeo_favorites enable row level security;
revoke all on public.objeo_favorites from anon, authenticated;
grant select,insert,delete on public.objeo_favorites to authenticated;
drop policy if exists "own favorites select" on public.objeo_favorites;
create policy "own favorites select" on public.objeo_favorites for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "own favorites insert" on public.objeo_favorites;
create policy "own favorites insert" on public.objeo_favorites for insert to authenticated with check (user_id=(select auth.uid()) and (case when is_pro then exists(select 1 from public.objeo_establishment_items where id=ad_id and status='open') else exists(select 1 from public.ads where id=ad_id and status='open') end));
drop policy if exists "own favorites delete" on public.objeo_favorites;
create policy "own favorites delete" on public.objeo_favorites for delete to authenticated using (user_id=(select auth.uid()));
create table if not exists public.objeo_account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(user_id)
);
alter table public.objeo_account_deletion_requests enable row level security;
revoke all on public.objeo_account_deletion_requests from anon, authenticated;
grant select on public.objeo_account_deletion_requests to authenticated;
grant insert(user_id) on public.objeo_account_deletion_requests to authenticated;
drop policy if exists "own deletion request select" on public.objeo_account_deletion_requests;
create policy "own deletion request select" on public.objeo_account_deletion_requests for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "own deletion request insert" on public.objeo_account_deletion_requests;
create policy "own deletion request insert" on public.objeo_account_deletion_requests for insert to authenticated with check(user_id=(select auth.uid()));
commit;
