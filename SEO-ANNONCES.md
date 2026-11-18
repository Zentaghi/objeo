# SEO: annonces publiques indexables

Le workflow `.github/workflows/seo-ads.yml` génère une page statique par annonce ouverte et met à jour `sitemap.xml`, toutes les heures ou manuellement.

## Configuration GitHub

Dans **Settings > Secrets and variables > Actions > New repository secret**, créer :
- `SUPABASE_URL` : URL du projet Supabase (`https://...supabase.co`)
- `SUPABASE_PUBLISHABLE_KEY` : clé **publishable / anon**, jamais une clé service_role.

La table `public.ads` doit autoriser, via RLS, la lecture publique **des seules annonces ouvertes** et des champs listés dans `scripts/generate_seo_pages.py`. Si le workflow retourne 401/403, corriger la politique RLS plutôt que d'utiliser une clé privilégiée.

Activer **Settings > Actions > General > Workflow permissions > Read and write permissions** pour autoriser le commit du sitemap et des pages. Puis lancer **Actions > Generate public SEO ad pages > Run workflow**.

Pages produites : `/annonces/<uuid>.html`. Elles contiennent uniquement les champs publics `id,kind,title,category,description,city,happened_on,created_at` : aucune adresse privée, email ou coordonnées GPS.

Une annonce fermée ou supprimée est retirée lors de la prochaine exécution réussie. GitHub Pages retourne alors 404. La suppression n'est pas instantanée et l'index Google se met à jour à son rythme.

Attention : les pages HTML sont publiques et peuvent être archivées par des moteurs de recherche. Éviter de publier des données personnelles dans les descriptions d'annonces.

Vérifier le résultat dans **Actions**, puis tester une URL d'annonce et soumettre `https://objeo.online/sitemap.xml` dans Google Search Console.
