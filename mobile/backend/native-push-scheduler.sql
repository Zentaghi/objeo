-- Database migration applied via Supabase; reproduce on staging before new deployments.
create extension if not exists pg_cron;
create table if not exists private.objeo_native_dispatch_tickets (
 token_hash bytea primary key, expires_at timestamptz not null,
 mode text not null check(mode in ('probe','dispatch'))
);
alter table private.objeo_native_dispatch_tickets enable row level security;
revoke all on private.objeo_native_dispatch_tickets from public,anon,authenticated,service_role;
create or replace function public.objeo_native_consume_ticket(p_token text)
returns text language plpgsql security definer set search_path='' as $$
declare v_mode text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
 delete from private.objeo_native_dispatch_tickets where token_hash=extensions.digest(p_token,'sha256') and expires_at>now() returning mode into v_mode;
 return v_mode;
end $$;
revoke all on function public.objeo_native_consume_ticket(text) from public,anon,authenticated;
grant execute on function public.objeo_native_consume_ticket(text) to service_role;
create or replace function private.objeo_dispatch_native_push(p_probe boolean default false)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_token text; v_request bigint;
begin
 delete from private.objeo_native_dispatch_tickets where expires_at<=now();
 if not p_probe and not exists(select 1 from public.objeo_native_push_queue q join public.objeo_native_devices d on d.token=q.token and d.user_id=q.user_id where q.next_attempt<=now() and q.attempts<5 and q.created_at>now()-interval '24 hours' and d.updated_at>now()-interval '30 days') then return null; end if;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.objeo_native_dispatch_tickets(token_hash,expires_at,mode) values(extensions.digest(v_token,'sha256'),now()+interval '2 minutes',case when p_probe then 'probe' else 'dispatch' end);
 select net.http_post(url:='https://cvsecsmaczyadidapuyi.supabase.co/functions/v1/objeo-native-push-worker',headers:=jsonb_build_object('Content-Type','application/json','x-objeo-dispatch-ticket',v_token),body:='{}'::jsonb,timeout_milliseconds:=90000) into v_request;
 return v_request;
end $$;
revoke all on function private.objeo_dispatch_native_push(boolean) from public,anon,authenticated,service_role;
-- Deploy worker with verify_jwt=false (one-time ticket authentication) and FCM secret, then probe before scheduling.
-- select private.objeo_dispatch_native_push(true);
-- select cron.schedule('objeo-native-push-minute','* * * * *',$job$select private.objeo_dispatch_native_push(false);$job$);
