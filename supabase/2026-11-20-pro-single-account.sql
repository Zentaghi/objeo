-- Objeo Pro: one account per establishment, no employee membership.
-- Run AFTER any previously applied pro-team-history.sql and pro-claims-inbox.sql.
-- Existing establishments, ads, claims and return history are preserved.
-- This migration is safe to run repeatedly.

-- Remove team-specific RLS permissions on professional listings.
drop policy if exists "pro team reads establishment items" on public.objeo_establishment_items;
drop policy if exists "pro team inserts establishment items" on public.objeo_establishment_items;
drop policy if exists "pro team updates establishment items" on public.objeo_establishment_items;

-- Restrict private claim evidence to the claimant or the establishment owner.
drop policy if exists "pro claimants submit" on public.objeo_pro_claims;
create policy "pro claimants submit" on public.objeo_pro_claims
for insert to authenticated with check (
 claimant_id=(select auth.uid()) and status='pending'
 and decided_at is null and decided_by is null
 and exists (
  select 1 from public.objeo_establishment_items i
  join public.objeo_establishments e on e.id=i.establishment_id
  where i.id=item_id and i.kind='found' and i.status='open'
   and e.owner_id<>(select auth.uid())
 )
);
drop policy if exists "pro claimants and staff read" on public.objeo_pro_claims;
drop policy if exists "pro claimants and owner read" on public.objeo_pro_claims;
create policy "pro claimants and owner read" on public.objeo_pro_claims
for select to authenticated using (
 claimant_id=(select auth.uid())
 or exists (
  select 1 from public.objeo_establishment_items i
  join public.objeo_establishments e on e.id=i.establishment_id
  where i.id=item_id and e.owner_id=(select auth.uid())
 )
);

-- The historical ledger can be read by the establishment account only.
drop policy if exists "pro team and owner read return history" on public.objeo_pro_return_events;
drop policy if exists "pro owner reads return history" on public.objeo_pro_return_events;
create policy "pro owner reads return history" on public.objeo_pro_return_events
for select to authenticated using(
 exists(select 1 from public.objeo_establishments e
 where e.id=establishment_id and e.owner_id=(select auth.uid()))
);

-- Retire member invitation RPCs and memberships entirely.
drop function if exists public.objeo_pro_add_member(uuid,text);
drop function if exists public.objeo_pro_remove_member(uuid,uuid);
drop policy if exists "pro team members read membership" on public.objeo_pro_team;
revoke all on public.objeo_pro_team from anon,authenticated;
drop table if exists public.objeo_pro_team;

-- Keep single-account ownership even on the server.
create unique index if not exists objeo_establishments_owner_unique on public.objeo_establishments(owner_id);
