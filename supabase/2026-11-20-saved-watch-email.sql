-- Objeo saved-object alerts: notify only after photo comparison, never on provisional INSERT.
-- Requires email-alert-log.sql and saved-watch-image-scoring.sql.
alter table public.objeo_email_alert_log drop constraint if exists objeo_email_alert_log_source_table_check;
alter table public.objeo_email_alert_log add constraint objeo_email_alert_log_source_table_check
check(source_table in ('objeo_claim_notifications','objeo_match_notifications','objeo_saved_object_matches'));

-- Supabase Dashboard > Database > Webhooks:
-- Delete/disable the existing INSERT webhook on public.objeo_saved_object_matches if present.
-- Create an UPDATE webhook for public.objeo_saved_object_matches instead.
-- Endpoint: https://cvsecsmaczyadidapuyi.supabase.co/functions/v1/objeo-alert-responder
-- Use the same secret-authentication method as the other Objeo notification webhooks.
-- Deploy the updated Edge Function first.
-- It will ignore rows without visual_checked_at, visual_score >= 45, match_score >= 60.
-- The email log prevents repeat emails for the same match.
