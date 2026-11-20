# Objeo — comparaison visuelle gratuite (prototype)
This worker uses the open-source CLIP model on a GitHub Actions CPU runner, without a paid inference API. GitHub Actions usage, storage, and bandwidth may still incur charges depending on plan/limits.

## Setup
1. Run `supabase/2026-11-20-saved-watch-image-scoring.sql` **after** the saved-object watch and scoring migrations.
2. In GitHub repository Settings → Secrets and variables → Actions, set `SUPABASE_URL` and **`SUPABASE_SERVICE_ROLE_KEY`**. Never commit or expose the service-role key in a public page.
3. In Actions, manually run **Objeo private visual matching** once, inspect logs and match results. The workflow is also scheduled every six hours.
4. Ensure the private bucket `objeo-private-objects` and public-ad bucket `ad-photos` are configured and image paths are present.

## Boundaries
- Compares photos **only for already-created text/city match candidates**; cannot discover matches with completely different text or city.
- Runs on the server with privileged access to private photos. Signed URLs are short-lived and not logged.
- Processes at most 20 matches per scheduled run. First run downloads CLIP model weights and may take time.
- Scores are **heuristics, not ownership probabilities**. No automatic ownership confirmation or contact disclosure.
- Existing match email webhook fires when text match is created, potentially **before** visual scoring. The image score does not trigger a new email.
- No production deployment or accuracy validation is implied by committing this workflow. Verify budget, model license, and retention/security policies before enabling for users.
