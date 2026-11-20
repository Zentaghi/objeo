-- Run once in Supabase SQL Editor for Objeo PRO photo uploads.
alter table public.objeo_establishment_items
  add column if not exists photo_path text;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('objeo-pro-photos','objeo-pro-photos',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

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

drop policy if exists "Objeo pro owner photo delete" on storage.objects;
create policy "Objeo pro owner photo delete"
on storage.objects for delete to authenticated
using (
 bucket_id='objeo-pro-photos'
 and exists (
  select 1 from public.objeo_establishments e
  where e.id::text=(storage.foldername(name))[1]
    and e.owner_id=(select auth.uid())
 )
);
-- Public read is provided by the public storage bucket.
