-- Run after saved-object-watch.sql and email-alert-log.sql
alter table public.objeo_email_alert_log drop constraint if exists objeo_email_alert_log_source_table_check;
alter table public.objeo_email_alert_log add constraint objeo_email_alert_log_source_table_check
check(source_table in ('objeo_claim_notifications','objeo_match_notifications','objeo_saved_object_matches'));
-- Deploy updated objeo-alert-responder Edge Function, then add a Database Webhook:
-- public.objeo_saved_object_matches UPDATE -> existing objeo-alert-responder endpoint.
-- IMPORTANT: INSERT webhooks send provisional matches too early and must be removed.
-- Only successful image worker updates with visual_score >= 45 and match_score >= 60 trigger an email.
-- Function verifies the owner_id (not recipient_id), and email is idempotent per match.
-- This requires redeploying supabase/functions/objeo-alert-responder/index.ts.
-- Authenticate the webhook with the same secret mechanism as the other notification webhooks.
