-- Objeo: author-only completion of lost or found listings.
-- Installed in the Objeo Supabase project on 2026-11-22.
-- "returned" is the existing database status for a closed, recovered listing.
-- No DELETE of ads, messages, claims or photos.

CREATE OR REPLACE FUNCTION public.objeo_close_own_ad(p_ad_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $objeo_close$
DECLARE
  v_kind text;
  v_status text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;

  SELECT a.kind, a.status
  INTO v_kind, v_status
  FROM public.ads a
  WHERE a.id = p_ad_id
    AND a.user_id = (SELECT auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Annonce introuvable ou accès refusé' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Cette annonce est déjà clôturée';
  END IF;

  IF v_kind = 'found' THEN
    PERFORM public.objeo_mark_returned(p_ad_id);
  ELSIF v_kind = 'lost' THEN
    UPDATE public.ads
    SET status = 'returned'
    WHERE id = p_ad_id AND user_id = (SELECT auth.uid()) AND status = 'open';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Annonce non clôturée';
    END IF;
  ELSE
    RAISE EXCEPTION 'Type d''annonce non pris en charge';
  END IF;

  RETURN 'returned';
END;
$objeo_close$;

REVOKE ALL ON FUNCTION public.objeo_close_own_ad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.objeo_close_own_ad(uuid) TO authenticated;

COMMENT ON FUNCTION public.objeo_close_own_ad(uuid)
IS 'Only the ad author can close their found/lost listing as returned; preserves all messages.';