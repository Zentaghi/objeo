-- Objeo — clôture automatique et historique conservé après remise entre particuliers.
-- À exécuter dans Supabase SQL Editor APRÈS :
-- 2026-11-20-two-party-restitution.sql
-- 2026-11-20-user-item-stats.sql
-- 2026-11-20-author-only-restitution.sql
-- Important : seul le responsable de l'annonce peut confirmer. Aucun effacement d'annonce ou de revendication.
-- L'application publique filtre déjà ads.status = 'open'.
--
-- 1) La restitution achevée est enregistrée dans objeo_restitution_confirmations.
-- 2) L'annonce passe à 'returned' atomiquement, elle disparaît des recherches publiques.
-- 3) Les demandes, échanges et justificatifs restent liés à l'annonce.
-- 4) Compteur incrémenté UNE fois par annonce.
--
-- Compatibilité : les restitutions antérieures sont prises en compte sans doublons.
update public.ads a
set status='returned'
where a.kind='found' and a.status='open' and exists (
  select 1 from public.objeo_restitution_confirmations c
  where c.ad_id=a.id and c.completed_at is not null
);

create or replace function public.objeo_confirm_restitution(p_claim_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
 v_claim record;
 v_new_completion integer;
begin
 if (select auth.uid()) is null then raise exception 'Connexion requise'; end if;
 -- Lock the ad first to avoid racing confirmations for different claims.
 select a.id,a.user_id as poster_id,a.kind,a.status
 into v_claim
 from public.ads a
 join public.objeo_claims c on c.ad_id=a.id
 where c.id=p_claim_id
 for update of a;
 if not found then raise exception 'Annonce ou revendication introuvable'; end if;
 if (select auth.uid()) is distinct from v_claim.poster_id then
   raise exception 'Seul l''auteur de l''annonce peut confirmer la restitution';
 end if;
 if v_claim.kind<>'found' then raise exception 'Seuls les objets trouvés peuvent être restitués'; end if;
 if v_claim.status<>'open' then raise exception 'Cette annonce est déjà clôturée'; end if;

 -- Record the accepted request only. Never accept proof automatically.
 perform 1 from public.objeo_claims c
 where c.id=p_claim_id and c.status='accepted' for update;
 if not found then raise exception 'Une revendication doit être acceptée avant confirmation'; end if;

 insert into public.objeo_restitution_confirmations
   (claim_id,ad_id,finder_id,claimant_id,finder_confirmed_at,completed_at)
 select c.id,c.ad_id,v_claim.poster_id,c.claimant_id,now(),now()
 from public.objeo_claims c where c.id=p_claim_id
 on conflict(claim_id) do update
 set finder_confirmed_at=coalesce(public.objeo_restitution_confirmations.finder_confirmed_at,excluded.finder_confirmed_at),
     completed_at=coalesce(public.objeo_restitution_confirmations.completed_at,excluded.completed_at);

 update public.ads set status='returned' where id=v_claim.id and status='open';

 insert into public.objeo_restitution_counted_ads(ad_id,poster_id)
 values(v_claim.id,v_claim.poster_id)
 on conflict(ad_id) do nothing;
 get diagnostics v_new_completion = row_count;
 if v_new_completion>0 then
   insert into public.objeo_user_item_stats(user_id,returned_count,updated_at)
   values(v_claim.poster_id,1,now())
   on conflict(user_id) do update
     set returned_count=public.objeo_user_item_stats.returned_count+1,
         updated_at=now();
 end if;
 return 'completed';
end $$;
revoke all on function public.objeo_confirm_restitution(uuid) from public,anon;
grant execute on function public.objeo_confirm_restitution(uuid) to authenticated;

-- Prevent accepting or rejecting new claims for a closed announcement.
create or replace function public.objeo_decide_claim(p_claim_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_claim record;
begin
 if (select auth.uid()) is null then raise exception 'Connexion requise'; end if;
 select a.user_id as poster_id,a.status as ad_status,c.status as claim_status
 into v_claim from public.ads a
 join public.objeo_claims c on c.ad_id=a.id
 where c.id=p_claim_id
 for update of a;
 if not found then raise exception 'Demande introuvable'; end if;
 if (select auth.uid()) is distinct from v_claim.poster_id then raise exception 'Accès refusé'; end if;
 if v_claim.ad_status<>'open' then raise exception 'Annonce déjà clôturée'; end if;
 if v_claim.claim_status<>'pending' then raise exception 'Demande déjà traitée'; end if;
 update public.objeo_claims
 set status=case when p_accept then 'accepted' else 'rejected' end
 where id=p_claim_id and status='pending';
end $$;
revoke all on function public.objeo_decide_claim(uuid,boolean) from public,anon;
grant execute on function public.objeo_decide_claim(uuid,boolean) to authenticated;

-- Compatibility with the original "Objet rendu" action in the classic interface.
-- This operation closes the listing WITHOUT deleting messages or claims.
-- It is deliberately restricted to the publishing user.
create or replace function public.objeo_mark_returned(p_ad_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_ad record; v_counted integer;
begin
 if (select auth.uid()) is null then raise exception 'Connexion requise'; end if;
 select id,user_id,kind,status into v_ad from public.ads where id=p_ad_id for update;
 if not found then raise exception 'Annonce introuvable'; end if;
 if (select auth.uid()) is distinct from v_ad.user_id then raise exception 'Accès refusé'; end if;
 if v_ad.kind<>'found' then raise exception 'Seuls les objets trouvés peuvent être restitués'; end if;
 if v_ad.status<>'open' then raise exception 'Annonce déjà clôturée'; end if;
 update public.ads set status='returned' where id=p_ad_id;
 insert into public.objeo_restitution_counted_ads(ad_id,poster_id)
 values(p_ad_id,v_ad.user_id) on conflict(ad_id) do nothing;
 get diagnostics v_counted = row_count;
 if v_counted>0 then
   insert into public.objeo_user_item_stats(user_id,returned_count,updated_at)
   values(v_ad.user_id,1,now())
   on conflict(user_id) do update
     set returned_count=public.objeo_user_item_stats.returned_count+1,updated_at=now();
 end if;
end $$;
revoke all on function public.objeo_mark_returned(uuid) from public,anon;
grant execute on function public.objeo_mark_returned(uuid) to authenticated;
