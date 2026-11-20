-- Run once in Supabase SQL Editor before deploying the alert function.
create table if not exists public.objeo_email_alert_log (
 source_table text not null check(source_table in ('objeo_claim_notifications','objeo_match_notifications')),
 notification_id uuid not null,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'processing' check(status in ('processing','sent')),
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 primary key(source_table,notification_id)
);
alter table public.objeo_email_alert_log enable row level security;
-- No client RLS policies: only the Edge Function's service-role client can access this table.
