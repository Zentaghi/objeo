# Audit et recette — Recherche / IA / partage Objeo

## Changements

- Même normalisation, stopwords et correction approximative pour recherche normale et recherche assistée.
- Recherche assistée accessible sans connexion, ciblée sur les objets trouvés, avec déduplication des résultats professionnels.
- Candidats visuels CLIP conservés pour les annonces perdues avec photo ; score visuel présenté comme un indice et non une probabilité de propriété.
- Fallback d'affichage de fiche lorsqu'une annonce chargée depuis Supabase n'est pas retrouvée par l'interface historique.
- Enrichissement de la récupération des annonces sans géolocalisation (latitude ou longitude absente) en filtrant par centre communal et rayon.
- Les partages et visuels utilisent également les annonces issues des résultats géographiques.
- Le bouton Instagram indique qu'il prépare un visuel ; publication automatique non promise.

## Recette manuelle obligatoire

1. Sans connexion, effectuer « clés noir perdu » dans Recherche assistée : si une annonce trouvée contient « clés noires », elle doit être proposée.
2. Tester « portefeuile », « clefs », « portable », « téléphone » dans les deux modes.
3. Ville Rouen + rayon 200 km : une annonce avec coordonnées à Évreux et une annonce sans coordonnées au Havre doivent apparaître si elles sont ouvertes et dans les 500 lignes éligibles.
4. Vérifier les filtres « Objets trouvés », « Tous », catégories et « Toute la France ».
5. Vérifier une annonce disponible via Supabase mais pas dans l'iframe historique : ouverture de la fiche, copier lien, partage natif et rechargement par URL.
6. Vérifier annonce professionnelle : pas de doublon, ouverture dans l'annuaire professionnel.
7. Vérifier le bouton Instagram sur iOS, Android et navigateur ordinateur, avec et sans photo, sans promettre de publication directe.
8. Vérifier la comparaison CLIP avec deux photos et en cas d'échec téléchargement/accès CORS.
9. Tester les messages d'erreur lorsque l'API commune ou la RPC Supabase est indisponible.
10. Vérifier la console du navigateur et le temps d'exécution pour 100+ annonces et nombreuses villes.

## Limites connues

- Les tables et fonctions Supabase n'ont pas été auditées ou migrées ici.
- La recherche géographique de secours repose au plus sur 500 annonces sans coordonnées récentes; une pagination serveur et géocodage à l'insertion restent nécessaires pour une couverture exhaustive.
- Le géocodage des villes sans coordonnées provoque des requêtes à l'API publique de communes (mises en cache localement). Prévoir un géocodage persistant côté serveur.
- Les résultats CLIP sont approximatifs et une vérification humaine est indispensable.
- Le fallback de fiche sur les annonces absentes de l'iframe fournit consultation et partage, pas encore toute la messagerie historique.
- Les parcours professionnels peuvent nécessiter un audit séparé de `annuaire.html` et de leurs autorisations Supabase.

## Tests automatisés

`node --test tests/search-sharing.test.mjs`
