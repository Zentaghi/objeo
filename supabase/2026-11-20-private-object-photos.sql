-- Run after 2026-11-20-private-saved-objects.sql
alter table public.objeo_saved_objects add column if not exists photo_path text;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('objeo-private-objects','objeo-private-objects',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "objeo_private_objects_read" on storage.objects;
create policy "objeo_private_objects_read" on storage.objects for select to authenticated
using (bucket_id='objeo-private-objects' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "objeo_private_objects_upload" on storage.objects;
create policy "objeo_private_objects_upload" on storage.objects for insert to authenticated
with check (bucket_id='objeo-private-objects' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "objeo_private_objects_delete" on storage.objects;
create policy "objeo_private_objects_delete" on storage.objects for delete to authenticated
using (bucket_id='objeo-private-objects' and (storage.foldername(name))[1]=(select auth.uid())::text);
