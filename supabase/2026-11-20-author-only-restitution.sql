-- Objeo: final restitution decision belongs exclusively to the listing author.
-- Run AFTER 2026-11-20-two-party-restitution.sql and 2026-11-20-user-item-stats.sql.
-- Safe to re-run; does not delete existing ads or claims.
-- Previously completed confirmations remain completed and are not counted again.
create or replace function public.objeo_confirm_restitution(p_claim_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
 v_claim record;
 v_new_completion integer;
begin
 if (select auth.uid()) is null then raise exception 'Connexion requise'; end if;

 select c.id,c.ad_id,c.claimant_id,c.status,a.user_id as poster_id,a.kind
 into v_claim
 from public.objeo_claims c
 join public.ads a on a.id=c.ad_id
 where c.id=p_claim_id
 for update of c;

 if not found then raise exception 'Annonce ou revendication introuvable'; end if;
 if (select auth.uid()) is distinct from v_claim.poster_id then
  raise exception 'Seul l''auteur de l''annonce peut confirmer la restitution';
 end if;
 if v_claim.kind <> 'found' or v_claim.status <> 'accepted' then
  raise exception 'Une revendication d''objet trouvé doit être acceptée avant confirmation';
 end if;

 insert into public.objeo_restitution_confirmations
 (claim_id,ad_id,finder_id,claimant_id,finder_confirmed_at,completed_at)
 values (v_claim.id,v_claim.ad_id,v_claim.poster_id,v_claim.claimant_id,now(),now())
 on conflict (claim_id) do update
 set finder_confirmed_at=coalesce(public.objeo_restitution_confirmations.finder_confirmed_at,excluded.finder_confirmed_at),
     completed_at=coalesce(public.objeo_restitution_confirmations.completed_at,excluded.completed_at);

 -- Count each listing's restitution only once, even if several claims were accepted.
 -- The row is locked by the claim above, and the ads row below serializes other claims.
 perform 1 from public.ads where id=v_claim.ad_id for update;
 -- The ledger prevents recounting on repeated RPC calls or separate accepted claims.
   insert into public.objeo_restitution_counted_ads(ad_id,poster_id)
   values(v_claim.ad_id,v_claim.poster_id)
   on conflict(ad_id) do nothing;
   get diagnostics v_new_completion = row_count;
   if v_new_completion > 0 then
     insert into public.objeo_user_item_stats(user_id,returned_count,updated_at)
     values(v_claim.poster_id,1,now())
     on conflict(user_id) do update
       set returned_count=public.objeo_user_item_stats.returned_count+1,
           updated_at=now();
   end if;
 return 'completed';
end $$;

-- Single-event ledger: unique per ad, never exposed for direct client writes.
create table if not exists public.objeo_restitution_counted_ads (
 ad_id uuid primary key,
 poster_id uuid not null,
 counted_at timestamptz not null default now()
);
alter table public.objeo_restitution_counted_ads enable row level security;
revoke all on public.objeo_restitution_counted_ads from anon,authenticated;
-- Seed the ledger from old completed restitutions to prevent double counts on retries.
insert into public.objeo_restitution_counted_ads(ad_id,poster_id)
select distinct on (ad_id) ad_id,finder_id
from public.objeo_restitution_confirmations
where completed_at is not null
order by ad_id,completed_at
on conflict(ad_id) do nothing;

revoke all on function public.objeo_confirm_restitution(uuid) from public,anon;
grant execute on function public.objeo_confirm_restitution(uuid) to authenticated;
