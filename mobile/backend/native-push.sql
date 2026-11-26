-- Separate native notification registration and queue. Existing Web Push worker is unchanged.
begin;
create table if not exists public.objeo_native_devices (
 token text primary key check (length(token) between 20 and 4096),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 updated_at timestamptz not null default now()
);
create index if not exists objeo_native_devices_user on public.objeo_native_devices(user_id);
alter table public.objeo_native_devices enable row level security;
revoke all on public.objeo_native_devices from anon,authenticated;
grant select,insert,update,delete on public.objeo_native_devices to authenticated;
drop policy if exists "own native devices select" on public.objeo_native_devices;
create policy "own native devices select" on public.objeo_native_devices for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "own native devices insert" on public.objeo_native_devices;
create policy "own native devices insert" on public.objeo_native_devices for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "own native devices update" on public.objeo_native_devices;
create policy "own native devices update" on public.objeo_native_devices for update to authenticated using (user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "own native devices delete" on public.objeo_native_devices;
create policy "own native devices delete" on public.objeo_native_devices for delete to authenticated using (user_id=(select auth.uid()));
create table if not exists public.objeo_native_push_queue (
 event_id bigint not null,
 token text not null references public.objeo_native_devices(token) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 attempts integer not null default 0,
 next_attempt timestamptz not null default now(),
 primary key(event_id, token)
);
alter table public.objeo_native_push_queue enable row level security;
revoke all on public.objeo_native_push_queue from anon, authenticated;
grant select,update,delete on public.objeo_native_push_queue to service_role;
grant select,delete on public.objeo_native_devices to service_role;
-- Copy only an event identifier, never message text, contact details or photo data.
create or replace function public.objeo_queue_native_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.objeo_native_push_queue(event_id,token,user_id)
 select new.id,d.token,new.user_id from public.objeo_native_devices d
 where d.user_id=new.user_id and d.updated_at>now()-interval '30 days'
 on conflict do nothing;
 return new;
exception when others then
 -- Failure to enqueue mobile notifications must not block existing web or core transactions.
 return new;
end $$;
revoke all on function public.objeo_queue_native_push() from public,anon,authenticated;
drop trigger if exists objeo_native_push_after_queue on public.objeo_push_queue;
create trigger objeo_native_push_after_queue after insert on public.objeo_push_queue for each row execute function public.objeo_queue_native_push();
commit;
