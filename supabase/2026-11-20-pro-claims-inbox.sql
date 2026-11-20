-- Objeo Pro — private claims and in-app notification inbox.
-- Run after professional-establishments.sql and pro-team-history.sql.
-- No email or external notification is sent; status is queried from the app.
create table if not exists public.objeo_pro_claims (
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.objeo_establishment_items(id) on delete cascade,
 claimant_id uuid not null references auth.users(id) on delete cascade,
 evidence text not null check(char_length(btrim(evidence)) between 20 and 1500),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references auth.users(id) on delete set null,
 unique(item_id,claimant_id)
);
create index if not exists objeo_pro_claims_item_status_idx on public.objeo_pro_claims(item_id,status,created_at desc);
create index if not exists objeo_pro_claims_claimant_idx on public.objeo_pro_claims(claimant_id,created_at desc);
alter table public.objeo_pro_claims enable row level security;
revoke all on public.objeo_pro_claims from anon,authenticated;
grant select,insert on public.objeo_pro_claims to authenticated;
drop policy if exists "pro claimants submit" on public.objeo_pro_claims;
create policy "pro claimants submit" on public.objeo_pro_claims for insert to authenticated
with check (
 claimant_id=(select auth.uid()) and status='pending' and decided_at is null and decided_by is null
 and exists (
 select 1 from public.objeo_establishment_items i
 join public.objeo_establishments e on e.id=i.establishment_id
 where i.id=item_id and i.kind='found' and i.status='open'
 and e.owner_id<>(select auth.uid())
 and not exists (
  select 1 from public.objeo_pro_team t where t.establishment_id=e.id and t.user_id=(select auth.uid())
 )
 )
);
drop policy if exists "pro claimants and staff read" on public.objeo_pro_claims;
create policy "pro claimants and staff read" on public.objeo_pro_claims for select to authenticated
using (
 claimant_id=(select auth.uid())
 or exists (
 select 1 from public.objeo_establishment_items i
 join public.objeo_establishments e on e.id=i.establishment_id
 where i.id=item_id and (
 e.owner_id=(select auth.uid()) or exists(
 select 1 from public.objeo_pro_team t where t.establishment_id=e.id and t.user_id=(select auth.uid())
 )
 ))
);
-- Only the publishing establishment owner can decide a claim.
create or replace function public.objeo_pro_decide_claim(p_claim_id uuid,p_accept boolean)
returns text language plpgsql security definer set search_path=''
as $$
declare v_claim record;
begin
 if (select auth.uid()) is null then raise exception 'Connexion requise'; end if;
 select c.id,c.status,i.status as item_status,e.owner_id
 into v_claim from public.objeo_pro_claims c
 join public.objeo_establishment_items i on i.id=c.item_id
 join public.objeo_establishments e on e.id=i.establishment_id
 where c.id=p_claim_id for update of c;
 if not found then raise exception 'Revendi­cation introuvable'; end if;
 if v_claim.owner_id is distinct from (select auth.uid()) then raise exception 'Seul le responsable peut décider'; end if;
 if v_claim.status<>'pending' or v_claim.item_status<>'open' then raise exception 'Demande déjà traitée ou annonce clôturée'; end if;
 update public.objeo_pro_claims
 set status=case when p_accept then 'accepted' else 'rejected' end,
     decided_at=now(),decided_by=(select auth.uid())
 where id=p_claim_id;
 return case when p_accept then 'accepted' else 'rejected' end;
end $$;
revoke all on function public.objeo_pro_decide_claim(uuid,boolean) from public,anon;
grant execute on function public.objeo_pro_decide_claim(uuid,boolean) to authenticated;

-- Claimant may track a request without seeing others' evidence.
-- Do not expose private claimant email or identity to other visitors.
