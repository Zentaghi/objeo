-- Objeo restitution: two-sided confirmation with an immutable event trail.
-- Run after security-claims-match-alerts.sql, claims-owner-decisions.sql,
-- and user-item-stats.sql. Existing claims and conversations remain intact.
create table if not exists public.objeo_restitution_confirmations (
  claim_id uuid primary key,
  ad_id uuid not null,
  finder_id uuid not null,
  claimant_id uuid not null,
  finder_confirmed_at timestamptz,
  claimant_confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists objeo_restitution_confirmation_ad_idx
  on public.objeo_restitution_confirmations(ad_id);
alter table public.objeo_restitution_confirmations enable row level security;
revoke all on public.objeo_restitution_confirmations from anon, authenticated;
grant select on public.objeo_restitution_confirmations to authenticated;
drop policy if exists "restitution parties read their status" on public.objeo_restitution_confirmations;
create policy "restitution parties read their status"
on public.objeo_restitution_confirmations for select to authenticated
using ((select auth.uid()) in (finder_id,claimant_id));

create or replace function public.objeo_confirm_restitution(p_claim_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare v_claim record; v_current uuid; v_completed integer;
begin
 v_current := (select auth.uid());
 if v_current is null then raise exception 'Connexion requise'; end if;
 select c.id,c.ad_id,c.claimant_id,c.status,a.user_id as finder_id,a.kind
 into v_claim from public.objeo_claims c
 join public.ads a on a.id = c.ad_id
 where c.id=p_claim_id for update of c;
 if not found then raise exception 'Annonce ou revendication introuvable'; end if;
 if v_claim.status <> 'accepted' or v_claim.kind <> 'found' then
  raise exception 'La revendication doit être acceptée';
 end if;
 if v_current <> v_claim.finder_id and v_current <> v_claim.claimant_id then
  raise exception 'Accès refusé';
 end if;
 insert into public.objeo_restitution_confirmations(claim_id,ad_id,finder_id,claimant_id)
 values(v_claim.id,v_claim.ad_id,v_claim.finder_id,v_claim.claimant_id)
 on conflict(claim_id) do nothing;
 if v_current=v_claim.finder_id then
  update public.objeo_restitution_confirmations set finder_confirmed_at=coalesce(finder_confirmed_at,now())
  where claim_id=p_claim_id;
 else
  update public.objeo_restitution_confirmations set claimant_confirmed_at=coalesce(claimant_confirmed_at,now())
  where claim_id=p_claim_id;
 end if;
 update public.objeo_restitution_confirmations
 set completed_at=now()
 where claim_id=p_claim_id and completed_at is null
   and finder_confirmed_at is not null and claimant_confirmed_at is not null;
 get diagnostics v_completed = row_count;
 if v_completed > 0 then
  insert into public.objeo_user_item_stats(user_id,returned_count,updated_at)
  values(v_claim.finder_id,1,now())
  on conflict(user_id) do update
    set returned_count=public.objeo_user_item_stats.returned_count+1,updated_at=now();
  return 'completed';
 end if;
 return 'pending';
end $$;
revoke all on function public.objeo_confirm_restitution(uuid) from public,anon;
grant execute on function public.objeo_confirm_restitution(uuid) to authenticated;

-- Keep the legacy "close a found ad" button compatible with confirmed handovers.
-- Never count the same completed restitution twice.
create or replace function public.objeo_mark_returned(p_ad_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_ad record;
begin
 select id,user_id,kind into v_ad from public.ads where id=p_ad_id for update;
 if not found then raise exception 'Annonce introuvable'; end if;
 if (select auth.uid()) is distinct from v_ad.user_id then raise exception 'Accès refusé'; end if;
 if v_ad.kind<>'found' then raise exception 'Seuls les objets trouvés peuvent être restitués'; end if;
 if not exists(
   select 1 from public.objeo_restitution_confirmations
   where ad_id=p_ad_id and completed_at is not null
 ) then
   insert into public.objeo_user_item_stats(user_id,returned_count,updated_at)
   values(v_ad.user_id,1,now())
   on conflict(user_id) do update
     set returned_count=public.objeo_user_item_stats.returned_count+1,updated_at=now();
 end if;
 delete from public.ads where id=p_ad_id;
end $$;
revoke all on function public.objeo_mark_returned(uuid) from public,anon;
grant execute on function public.objeo_mark_returned(uuid) to authenticated;
-- IMPORTANT: Completing confirmation does not delete the ad or its conversations.
-- Finder may close the ad afterward; existing close behavior deletes ad/messages.
