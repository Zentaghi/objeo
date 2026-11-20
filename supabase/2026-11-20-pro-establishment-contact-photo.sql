-- Run in Supabase SQL Editor after the initial Objeo PRO tables and photo bucket migrations.
alter table public.objeo_establishments
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists photo_path text;
-- The existing public-read establishment policy makes these voluntary contact fields public.
-- Establishment photos use the existing objeo-pro-photos storage bucket and owner-only upload policy.
