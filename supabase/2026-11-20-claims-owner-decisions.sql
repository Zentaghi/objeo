-- Run in Supabase SQL Editor after the claims migration.
-- The decision is made through a SECURITY DEFINER RPC so owners cannot edit evidence/claimant.
drop policy if exists "owners decide claims" on public.objeo_claims;
create or replace function public.objeo_decide_claim(p_claim_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_ad_id uuid; v_owner uuid; v_status text;
begin
 select c.ad_id,a.user_id,c.status into v_ad_id,v_owner,v_status
 from public.objeo_claims c join public.ads a on a.id=c.ad_id
 where c.id=p_claim_id for update of c;
 if not found then raise exception 'Demande introuvable'; end if;
 if auth.uid() is null or auth.uid()<>v_owner then raise exception 'Accès refusé'; end if;
 if v_status<>'pending' then raise exception 'Demande déjà traitée'; end if;
 update public.objeo_claims set status=case when p_accept then 'accepted' else 'rejected' end
 where id=p_claim_id;
end $$;
revoke all on function public.objeo_decide_claim(uuid,boolean) from public;
grant execute on function public.objeo_decide_claim(uuid,boolean) to authenticated;
-- A claimant can read their own decision; the ad owner can read the evidence.
-- Neither claimant nor ad owner can modify the evidence after submission.
create index if not exists objeo_claims_ad_status_idx on public.objeo_claims(ad_id,status,created_at desc);
