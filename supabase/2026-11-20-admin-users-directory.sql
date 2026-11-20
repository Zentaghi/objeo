-- Admin-only user directory. Run AFTER admin moderation migrations.
-- Emails are private and are returned ONLY to authenticated admins through this RPC.
create or replace function public.objeo_admin_users(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare v_query text := left(trim(coalesce(p_search,'')),100);
declare v_limit integer := least(greatest(coalesce(p_limit,50),1),100);
declare v_offset integer := least(greatest(coalesce(p_offset,0),0),100000);
declare v_result jsonb;
begin
 if (select auth.uid()) is null or not exists (
  select 1 from public.objeo_admins where user_id=(select auth.uid())
 ) then
  raise exception 'Accès administrateur refusé' using errcode='42501';
 end if;
 select jsonb_build_object(
  'total', (select count(*) from auth.users u
   where v_query='' or u.email ilike '%'||v_query||'%'
   or coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','') ilike '%'||v_query||'%'
   or u.id::text=v_query),
  'users',coalesce((
   select jsonb_agg(to_jsonb(t) order by t.created_at desc)
   from (
    select u.id,u.email,
     coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','')),''),'Membre Objeo') as display_name,
     u.created_at,u.last_sign_in_at,
     (select count(*) from public.ads a where a.user_id=u.id) as ads_count,
     (select count(*) from public.objeo_reports r where r.reporter_id=u.id) as reports_sent,
     (select count(*) from public.objeo_reports r join public.ads a on a.id=r.ad_id where a.user_id=u.id) as reports_received,
     exists(select 1 from public.objeo_user_suspensions s where s.user_id=u.id) as suspended,
     exists(select 1 from public.objeo_admins adm where adm.user_id=u.id) as is_admin
    from auth.users u
    where v_query='' or u.email ilike '%'||v_query||'%'
     or coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','') ilike '%'||v_query||'%'
     or u.id::text=v_query
    order by u.created_at desc limit v_limit offset v_offset
   ) t
  ),'[]'::jsonb)
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.objeo_admin_users(text,integer,integer) from public, anon;
grant execute on function public.objeo_admin_users(text,integer,integer) to authenticated;
