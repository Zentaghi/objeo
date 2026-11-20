# Notifications e-mail Objeo via Resend

This Edge Function reuses the same secrets as the existing `hyper-responder` message function.

1. Execute `supabase/2026-11-20-email-alert-log.sql` in Supabase SQL Editor.
2. Create a Supabase Edge Function named `objeo-alert-responder`, paste `supabase/functions/objeo-alert-responder/index.ts` and deploy it. Keep secret authentication enabled, as in `hyper-responder`.
3. In Supabase Edge Function secrets, confirm `RESEND_API_KEY`, `RESEND_FROM`, and optional `SITE_URL=https://objeo.online`.
4. Under **Database > Webhooks**, create two POST webhooks for INSERT only:
   - `public.objeo_claim_notifications` → `https://cvsecsmaczyadidapuyi.supabase.co/functions/v1/objeo-alert-responder`
   - `public.objeo_match_notifications` → the same URL.
   Configure the webhook secret header according to Supabase's `auth: "secret"` function deployment (the same method used by your existing `hyper-responder`). Do not use the public anon key or expose the secret in frontend code.
5. Test by making a claim from a second user and creating a new matching lost/found ad. Confirm receipt and a `sent` row in `objeo_email_alert_log`.

This sends email in addition to existing in-app notifications. It does not email historical notifications. Existing `hyper-responder` is unchanged.

Note: the anti-duplicate log reserves rows before sending; if the function crashes while processing, an unfinished `processing` row may need manual review. For production-scale guaranteed retries, use a durable queue/outbox.

## Private inventory: « Peut-être que c’est à vous ? 👀 »

1. Run `supabase/2026-11-20-saved-watch-email.sql` (after the email log and visual-score migrations).
2. Deploy the current `supabase/functions/objeo-alert-responder/index.ts` Edge Function.
3. **Important:** remove any INSERT webhook for `public.objeo_saved_object_matches`; add an **UPDATE** webhook for that table to the same function, with the same secret authentication. Keep the existing claim and match INSERT webhooks unchanged.
4. Only visually processed matches with `visual_checked_at IS NOT NULL`, `visual_score >= 45`, and `match_score >= 60` trigger an email. Thresholds are heuristics, not proof of ownership.
5. The subject is **Objeo : Peut-être que c’est à vous ? 👀**; its link leads to `https://objeo.online/mes-objets.html`.
6. Verify delivery with two test accounts, inspect function logs and `public.objeo_email_alert_log`. Email delivery requires configured Resend secrets and a verified sending domain.
