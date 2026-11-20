-- Public aggregate for Objeo homepage; no user details are exposed.
-- Prerequisite: supabase/2026-11-20-user-item-stats.sql
create or replace function public.objeo_public_return_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
 select coalesce(sum(returned_count),0)::bigint
 from public.objeo_user_item_stats;
$$;
revoke all on function public.objeo_public_return_count() from public;
grant execute on function public.objeo_public_return_count() to anon, authenticated;
-- Only the aggregate is returned. Individual users' statistics remain RLS-protected.
