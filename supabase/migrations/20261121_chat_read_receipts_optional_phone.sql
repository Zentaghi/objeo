-- Objeo messages: read receipts + optional phone after an ACCEPTED claim.
-- Run in the SQL editor of the correct Objeo Supabase project, with admin privileges.
-- Assumes conversations.id, ads.id and objeo_claims.id are UUID.
BEGIN;

CREATE TABLE IF NOT EXISTS public.objeo_message_reads (
 conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 last_read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS objeo_message_reads_user_idx ON public.objeo_message_reads(user_id);
ALTER TABLE public.objeo_message_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.objeo_message_reads FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.objeo_message_reads TO authenticated;
DROP POLICY IF EXISTS objeo_read_own_receipts ON public.objeo_message_reads;
CREATE POLICY objeo_read_own_receipts ON public.objeo_message_reads
FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS objeo_insert_own_receipts ON public.objeo_message_reads;
CREATE POLICY objeo_insert_own_receipts ON public.objeo_message_reads
FOR INSERT TO authenticated WITH CHECK (
 user_id = (SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.conversations c JOIN public.ads a ON a.id=c.ad_id
 WHERE c.id=conversation_id AND (c.seeker_id=(SELECT auth.uid()) OR a.user_id=(SELECT auth.uid()))
 ));
DROP POLICY IF EXISTS objeo_update_own_receipts ON public.objeo_message_reads;
CREATE POLICY objeo_update_own_receipts ON public.objeo_message_reads
FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid()))
WITH CHECK (user_id=(SELECT auth.uid()) AND EXISTS (
 SELECT 1 FROM public.conversations c JOIN public.ads a ON a.id=c.ad_id
 WHERE c.id=conversation_id AND (c.seeker_id=(SELECT auth.uid()) OR a.user_id=(SELECT auth.uid()))
));

-- Phone number never shared by default. The owner must explicitly opt in.
CREATE TABLE IF NOT EXISTS public.objeo_contact_preferences (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 phone text,
 share_phone_after_acceptance boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT objeo_contact_phone_format CHECK (phone IS NULL OR phone ~ '^[+]?[0-9(). -]{6,25}$')
);
ALTER TABLE public.objeo_contact_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.objeo_contact_preferences FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objeo_contact_preferences TO authenticated;
DROP POLICY IF EXISTS objeo_contact_preferences_self ON public.objeo_contact_preferences;
CREATE POLICY objeo_contact_preferences_self ON public.objeo_contact_preferences
FOR ALL TO authenticated USING (user_id=(SELECT auth.uid()))
WITH CHECK (user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.objeo_accepted_claim_phone(p_claim_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT cp.phone FROM public.objeo_claims c
 JOIN public.ads a ON a.id=c.ad_id
 JOIN public.objeo_contact_preferences cp ON cp.user_id=a.user_id
 WHERE c.id=p_claim_id
 AND c.claimant_id=(SELECT auth.uid())
 AND c.status='accepted'
 AND a.user_id<>c.claimant_id
 AND cp.share_phone_after_acceptance IS TRUE
 AND cp.phone IS NOT NULL
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.objeo_accepted_claim_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.objeo_accepted_claim_phone(uuid) TO authenticated;
COMMENT ON FUNCTION public.objeo_accepted_claim_phone(uuid)
IS 'Opt-in phone for the accepted claimant only; never shared for pending or rejected claims.';

COMMIT;

-- Validation cases:
-- Unrelated user, anon, pending/rejected claimant => no phone.
-- Accepted claimant with owner opt-in => phone.
-- A user cannot create read markers for a conversation they do not belong to.
