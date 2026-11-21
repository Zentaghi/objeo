-- Objeo: reveal the listing author's contact only to the claimant
-- after the author has accepted the ownership claim.
-- Apply in Supabase SQL Editor as a privileged project administrator.
-- Assumes public.objeo_claims.id, .ad_id, and public.ads.id are UUIDs.
BEGIN;

CREATE OR REPLACE FUNCTION public.objeo_accepted_claim_contact(p_claim_id uuid)
RETURNS TABLE(poster_name text, poster_email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(
      NULLIF(BTRIM(u.raw_user_meta_data ->> 'name'), ''),
      NULLIF(BTRIM(u.raw_user_meta_data ->> 'full_name'), ''),
      'Membre Objeo'
    )::text AS poster_name,
    u.email::text AS poster_email
  FROM public.objeo_claims AS c
  JOIN public.ads AS a ON a.id = c.ad_id
  JOIN auth.users AS u ON u.id = a.user_id
  WHERE c.id = p_claim_id
    AND c.claimant_id = (SELECT auth.uid())
    AND c.status = 'accepted'
    AND a.user_id <> c.claimant_id
    AND u.email IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.objeo_accepted_claim_contact(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.objeo_accepted_claim_contact(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.objeo_accepted_claim_contact(uuid) TO authenticated;

COMMENT ON FUNCTION public.objeo_accepted_claim_contact(uuid)
IS 'Returns an ad author name and email only to the authenticated claimant of an accepted claim.';

COMMIT;

-- Verify after installation (read-only):
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS signature,
--        p.prosecdef AS security_definer
-- FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.proname='objeo_accepted_claim_contact';
