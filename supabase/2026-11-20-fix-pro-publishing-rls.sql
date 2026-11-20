-- Objeo PRO: reapply owner-scoped publication and photo permissions.
-- Run in Supabase SQL Editor with the initial Objeo PRO migrations already applied.
alter table public.objeo_establishments enable row level security;
alter table public.objeo_establishment_items enable row level security;

drop policy if exists "owners insert establishment items" on public.objeo_establishment_items;
create policy "owners insert establishment items"
on public.objeo_establishment_items for insert to authenticated
with check (
 exists (
  select 1 from public.objeo_establishments e
  where e.id=establishment_id and e.owner_id=(select auth.uid())
 )
);

drop policy if exists "owners update establishment items" on public.objeo_establishment_items;
create policy "owners update establishment items"
on public.objeo_establishment_items for update to authenticated
using (
 exists (select 1 from public.objeo_establishments e
  where e.id=establishment_id and e.owner_id=(select auth.uid()))
)
with check (
 exists (select 1 from public.objeo_establishments e
  where e.id=establishment_id and e.owner_id=(select auth.uid()))
);

drop policy if exists "Objeo pro owner photo upload" on storage.objects;
create policy "Objeo pro owner photo upload"
on storage.objects for insert to authenticated
with check (
 bucket_id='objeo-pro-photos'
 and exists (
  select 1 from public.objeo_establishments e
  where e.id::text=(storage.foldername(name))[1]
    and e.owner_id=(select auth.uid())
 )
);

-- Diagnose ownership for the signed-in account in the browser:
-- SELECT id, owner_id, name FROM public.objeo_establishments;
-- Note: SQL Editor uses an admin context, not the browser user's auth.uid().
