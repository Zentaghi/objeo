-- Upgrade the separate native queue to source-event keys (including native-only recipients).
begin;
drop trigger if exists objeo_native_push_after_queue on public.objeo_push_queue;
drop function if exists public.objeo_queue_native_push();
alter table public.objeo_native_push_queue add column if not exists event_key text;
update public.objeo_native_push_queue set event_key=event_id::text where event_key is null;
alter table public.objeo_native_push_queue alter column event_key set not null;
alter table public.objeo_native_push_queue drop constraint if exists objeo_native_push_queue_pkey;
alter table public.objeo_native_push_queue drop column if exists event_id;
alter table public.objeo_native_push_queue add primary key(event_key,token);
create index if not exists objeo_native_queue_due on public.objeo_native_push_queue(next_attempt);
create or replace function private.objeo_enqueue_native_event()
returns trigger language plpgsql security definer set search_path='' as $$
declare recipients uuid[]; event text;
begin
 case tg_table_name
 when 'messages' then
 select array[case when c.seeker_id=new.sender_id then a.user_id else c.seeker_id end] into recipients
 from public.conversations c join public.ads a on a.id=c.ad_id
 where c.id=new.conversation_id and new.sender_id in(c.seeker_id,a.user_id);
 event:='message:'||new.id::text;
 when 'objeo_pro_messages' then
 select array_agg(distinct r.uid) into recipients
 from public.objeo_pro_conversations c join public.objeo_establishment_items i on i.id=c.item_id
 join public.objeo_establishments e on e.id=i.establishment_id
 cross join lateral (
 select c.seeker_id as uid where new.sender_id=e.owner_id or exists(select 1 from public.objeo_pro_team t where t.establishment_id=e.id and t.user_id=new.sender_id)
 union select e.owner_id where new.sender_id=c.seeker_id
 union select t.user_id from public.objeo_pro_team t where t.establishment_id=e.id and new.sender_id=c.seeker_id
 ) r where c.id=new.conversation_id and r.uid<>new.sender_id;
 event:='pro-message:'||new.id::text;
 when 'objeo_match_notifications' then recipients:=array[new.recipient_id];event:='match:'||new.id::text;
 when 'objeo_claim_notifications' then recipients:=array[new.recipient_id];event:='claim:'||new.id::text;
 when 'objeo_saved_object_matches' then recipients:=array[new.owner_id];event:='saved:'||new.id::text;
 when 'objeo_restitution_confirmations' then
 if new.completed_at is null then return new; end if;
 recipients:=array[new.finder_id,new.claimant_id];event:='restitution:'||new.claim_id::text;
 else return new;
 end case;
 insert into public.objeo_native_push_queue(event_key,token,user_id)
 select event,d.token,d.user_id from public.objeo_native_devices d
 where d.user_id=any(recipients) and d.updated_at>now()-interval '30 days'
 on conflict(event_key,token) do nothing;
 return new;
exception when others then
 raise warning 'Native push queue: %',sqlstate; return new;
end $$;
revoke all on function private.objeo_enqueue_native_event() from public,anon,authenticated;
drop trigger if exists objeo_native_message on public.messages;
create trigger objeo_native_message after insert on public.messages for each row execute function private.objeo_enqueue_native_event();
drop trigger if exists objeo_native_pro_message on public.objeo_pro_messages;
create trigger objeo_native_pro_message after insert on public.objeo_pro_messages for each row execute function private.objeo_enqueue_native_event();
drop trigger if exists objeo_native_match on public.objeo_match_notifications;
create trigger objeo_native_match after insert on public.objeo_match_notifications for each row execute function private.objeo_enqueue_native_event();
drop trigger if exists objeo_native_claim on public.objeo_claim_notifications;
create trigger objeo_native_claim after insert on public.objeo_claim_notifications for each row execute function private.objeo_enqueue_native_event();
drop trigger if exists objeo_native_saved on public.objeo_saved_object_matches;
create trigger objeo_native_saved after insert on public.objeo_saved_object_matches for each row execute function private.objeo_enqueue_native_event();
drop trigger if exists objeo_native_restitution on public.objeo_restitution_confirmations;
create trigger objeo_native_restitution after insert or update of completed_at on public.objeo_restitution_confirmations for each row execute function private.objeo_enqueue_native_event();
create or replace function public.objeo_native_claim_batch()
returns table(event_key text,token text,user_id uuid,attempts integer)
language sql security invoker set search_path='' as $$
 with due as (select q.event_key,q.token from public.objeo_native_push_queue q join public.objeo_native_devices d on d.token=q.token and d.user_id=q.user_id where q.next_attempt<=now() and q.attempts<5 and q.created_at>now()-interval '24 hours' and d.updated_at>now()-interval '30 days' order by q.created_at limit 50 for update of q skip locked)
 update public.objeo_native_push_queue q set attempts=q.attempts+1,next_attempt=now()+interval '10 minutes'
 from due where q.event_key=due.event_key and q.token=due.token returning q.event_key,q.token,q.user_id,q.attempts;
$$;
revoke all on function public.objeo_native_claim_batch() from public,anon,authenticated;
grant execute on function public.objeo_native_claim_batch() to service_role;
commit;
