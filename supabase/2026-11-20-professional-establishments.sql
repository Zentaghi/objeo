-- Execute once in Supabase SQL Editor before enabling the professional portal.
create table if not exists public.objeo_establishments (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 120),
 kind text not null default 'Autre',
 city text not null,
 address text,
 description text,
 created_at timestamptz not null default now()
);
create unique index if not exists objeo_establishments_owner_unique on public.objeo_establishments(owner_id);
create table if not exists public.objeo_establishment_items (
 id uuid primary key default gen_random_uuid(),
 establishment_id uuid not null references public.objeo_establishments(id) on delete cascade,
 title text not null check (char_length(title) between 3 and 120),
 category text not null default 'Autres objets',
 description text,
 kind text not null default 'found' check (kind in ('found','lost')),
 happened_on date not null default current_date,
 status text not null default 'open' check (status in ('open','returned')),
 created_at timestamptz not null default now()
);
create index if not exists objeo_establishment_items_establishment_idx on public.objeo_establishment_items(establishment_id,created_at desc);
alter table public.objeo_establishments enable row level security;
alter table public.objeo_establishment_items enable row level security;
drop policy if exists "public read establishments" on public.objeo_establishments;
create policy "public read establishments" on public.objeo_establishments for select using (true);
drop policy if exists "owners insert establishments" on public.objeo_establishments;
create policy "owners insert establishments" on public.objeo_establishments for insert to authenticated with check (owner_id=auth.uid());
drop policy if exists "owners update establishments" on public.objeo_establishments;
create policy "owners update establishments" on public.objeo_establishments for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists "public read establishment items" on public.objeo_establishment_items;
create policy "public read establishment items" on public.objeo_establishment_items for select using (true);
drop policy if exists "owners insert establishment items" on public.objeo_establishment_items;
create policy "owners insert establishment items" on public.objeo_establishment_items for insert to authenticated with check (exists(select 1 from public.objeo_establishments e where e.id=establishment_id and e.owner_id=auth.uid()));
drop policy if exists "owners update establishment items" on public.objeo_establishment_items;
create policy "owners update establishment items" on public.objeo_establishment_items for update to authenticated using (exists(select 1 from public.objeo_establishments e where e.id=establishment_id and e.owner_id=auth.uid())) with check (exists(select 1 from public.objeo_establishments e where e.id=establishment_id and e.owner_id=auth.uid()));
-- An establishment is self-declared, not independently verified.
