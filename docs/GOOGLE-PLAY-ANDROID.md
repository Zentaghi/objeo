# Publication d'Objeo sur Google Play (PWA / Trusted Web Activity)

Objeo est actuellement un site statique HTML/JavaScript publié sur https://objeo.online via GitHub Pages. Il ne s'agit pas d'un projet Expo : utiliser PWABuilder / Bubblewrap pour générer le paquet Android plutôt qu'EAS Build.

## Préparation
- Le fichier `site.webmanifest` est lié dans `index.html`.
- Le service worker `/sw.js` est enregistré depuis la page d'accueil. En cas de panne réseau, la navigation affiche `/offline.html`. Les annonces, messages, API et comptes ne sont **pas** mis en cache.
- **À finaliser avant le packaging :** ajouter des icônes PNG carrées 192 × 192 et 512 × 512 au manifeste, en plus de l'icône SVG (préférer les fichiers PNG dérivés du logo officiel). L'icône Apple devrait aussi être en PNG, idéalement 180 × 180.
- Vérifier sur la version publique que `/site.webmanifest`, `/sw.js` et les icônes sont accessibles en HTTPS.
- Tester les flux sur Android : authentification Supabase, lien de récupération de mot de passe, envoi de photos, partage et messagerie. Ne pas promettre les notifications push sans implémentation Android spécifique.

## Construction avec PWABuilder
1. Aller sur https://www.pwabuilder.com et saisir `https://objeo.online/`.
2. Vérifier les audits / corriger les avertissements.
3. Générer un package **Android pour Google Play** (TWA).
4. Choisir et conserver définitivement l'identifiant d'application Android (exemple `online.objeo.app`), les paramètres de signature et le fichier de clé privée dans un endroit sûr. Ne **jamais** déposer ces clés sur GitHub.
5. Télécharger le `.aab` pour Play Console et l'`.apk` pour tester.

## Association du domaine (obligatoire pour l'affichage TWA sans barre de navigateur)
Récupérer le fichier `assetlinks.json` fourni par PWABuilder **après** avoir choisi l'identifiant Android et la signature, puis le publier sur :
`https://objeo.online/.well-known/assetlinks.json`

Le contenu doit utiliser l'identifiant réel du package et l'empreinte SHA-256 appropriée du certificat de signature (avec Play App Signing, vérifier la clé de signature d'application affichée dans Play Console). Ne pas mettre d'empreinte fictive.

## Google Play
- Déposer le fichier `.aab`.
- Préparer fiche store, captures d'écran, politique de confidentialité, suppression de compte, formulaire de sécurité des données et déclarations des accès sensibles si applicables.
- Les comptes développeur **personnels** créés après le 13 novembre 2023 doivent généralement réussir un test fermé avec au moins 12 testeurs inscrits sans interruption pendant 14 jours avant de demander l'accès à la production.
- Ne pas publier tant que les contrôles fonctionnels et les exigences de Google Play ne sont pas satisfaits.

Sources :
- https://github.com/pwa-builder/PWABuilder/blob/main/docs/builder/android.md
- https://support.google.com/googleplay/android-developer/answer/14151465
