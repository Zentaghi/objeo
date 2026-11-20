-- Objeo private inventory: run in Supabase SQL editor.
create table if not exists public.objeo_saved_objects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 2 and 100),
 category text not null default 'Autre',
 city text not null default '',
 description text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists objeo_saved_objects_owner_idx on public.objeo_saved_objects(owner_id);
alter table public.objeo_saved_objects enable row level security;
revoke all on public.objeo_saved_objects from anon;
grant select,insert,update,delete on public.objeo_saved_objects to authenticated;
drop policy if exists "saved_objects_select_own" on public.objeo_saved_objects;
create policy "saved_objects_select_own" on public.objeo_saved_objects for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "saved_objects_insert_own" on public.objeo_saved_objects;
create policy "saved_objects_insert_own" on public.objeo_saved_objects for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "saved_objects_update_own" on public.objeo_saved_objects;
create policy "saved_objects_update_own" on public.objeo_saved_objects for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "saved_objects_delete_own" on public.objeo_saved_objects;
create policy "saved_objects_delete_own" on public.objeo_saved_objects for delete to authenticated using (owner_id = (select auth.uid()));
