-- Run after 2026-11-20-saved-watch-scoring-v2.sql
alter table public.objeo_saved_object_matches
 add column if not exists visual_score integer check(visual_score between 0 and 100),
 add column if not exists visual_checked_at timestamptz;
-- These fields remain visible only to the match owner through existing RLS.
create index if not exists objeo_saved_matches_unchecked_idx
 on public.objeo_saved_object_matches(created_at)
 where visual_checked_at is null;
