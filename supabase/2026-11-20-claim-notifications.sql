-- Execute in Supabase SQL Editor after the claim decision migration.
-- Private, in-app notifications; no email/push sent.
create table if not exists public.objeo_claim_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 claim_id uuid not null references public.objeo_claims(id) on delete cascade,
 event_type text not null check (event_type in ('new_claim','accepted','rejected')),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique (claim_id,event_type)
);
create index if not exists objeo_claim_notifications_recipient_idx on public.objeo_claim_notifications(recipient_id,created_at desc);
alter table public.objeo_claim_notifications enable row level security;
drop policy if exists "claim notification recipient select" on public.objeo_claim_notifications;
create policy "claim notification recipient select" on public.objeo_claim_notifications for select to authenticated using (recipient_id=auth.uid());
drop policy if exists "claim notification recipient update" on public.objeo_claim_notifications;
create policy "claim notification recipient update" on public.objeo_claim_notifications for update to authenticated using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());
-- The recipient cannot create or delete notifications. Trigger uses SECURITY DEFINER.
create or replace function public.objeo_claim_notify_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare owner_id uuid;
begin
 if tg_op='INSERT' then
   select user_id into owner_id from public.ads where id=new.ad_id;
   if owner_id is not null and owner_id<>new.claimant_id then
     insert into public.objeo_claim_notifications(recipient_id,claim_id,event_type)
     values(owner_id,new.id,'new_claim') on conflict do nothing;
   end if;
 elsif tg_op='UPDATE' and old.status='pending' and new.status in ('accepted','rejected') and new.status<>old.status then
   insert into public.objeo_claim_notifications(recipient_id,claim_id,event_type)
   values(new.claimant_id,new.id,new.status) on conflict do nothing;
 end if;
 return new;
end $$;
drop trigger if exists objeo_claim_notifications_trigger on public.objeo_claims;
create trigger objeo_claim_notifications_trigger after insert or update of status on public.objeo_claims
for each row execute function public.objeo_claim_notify_trigger();
-- Backfill pending claims so existing owners also see an alert.
insert into public.objeo_claim_notifications(recipient_id,claim_id,event_type)
select a.user_id,c.id,'new_claim' from public.objeo_claims c
join public.ads a on a.id=c.ad_id where c.status='pending' and a.user_id<>c.claimant_id
on conflict do nothing;
