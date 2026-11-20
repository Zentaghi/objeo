-- Fix shadowed "name" column inside EXISTS in Supabase Storage RLS.
-- In the previous policy, unqualified name resolved to e.name (establishment name),
-- not storage.objects.name (uploaded object path).
drop policy if exists "Objeo pro owner photo upload" on storage.objects;
create policy "Objeo pro owner photo upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'objeo-pro-photos'
  and exists (
    select 1
    from public.objeo_establishments as e
    where e.id::text = (storage.foldername(storage.objects.name))[1]
      and e.owner_id = (select auth.uid())
  )
);
-- Deletion should also refer to storage.objects.name explicitly.
drop policy if exists "Objeo pro owner photo delete" on storage.objects;
create policy "Objeo pro owner photo delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'objeo-pro-photos'
  and exists (
    select 1
    from public.objeo_establishments as e
    where e.id::text = (storage.foldername(storage.objects.name))[1]
      and e.owner_id = (select auth.uid())
  )
);
