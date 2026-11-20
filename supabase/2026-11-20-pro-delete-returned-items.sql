-- Objeo PRO: allow the owning establishment account to delete its returned item listings.
-- Run in Supabase SQL Editor. Do not disable RLS.
drop policy if exists "owners delete establishment items" on public.objeo_establishment_items;
create policy "owners delete establishment items"
on public.objeo_establishment_items
for delete to authenticated
using (
  exists (
    select 1 from public.objeo_establishments e
    where e.id = establishment_id
      and e.owner_id = (select auth.uid())
  )
);
-- The existing "Objeo pro owner photo delete" storage.objects policy
-- permits deleting photos in folders belonging to the same establishment.
