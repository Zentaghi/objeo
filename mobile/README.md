# Objeo Android natif
Branche android-native, séparée du site de production. React Native / Expo SDK 55, Supabase existant. Pas de WebView pour les écrans métier.

## Tester
Node 22, JDK 21 complet, SDK Android 36. Les icônes et le splash ont des marges adaptées; reconstruire le binaire (un rechargement Metro ne suffit pas).
```sh
cd mobile
npm install
npx expo prebuild --platform android --clean
npx expo run:android
```
Le workflow GitHub Actions **Objeo Android native - APK preview** compile un APK autonome d'essai et joint le lockfile. Vérifier le résultat avant d'installer. Cet APK utilise le package temporaire online.objeo.nativepreview; pas de publication Google Play.

## Authentification
Session chiffrée via Android Keystore, Google et retours email en PKCE. Avant test ajouter les URLs exactes dans Supabase Auth > URL Configuration > Redirect URLs :
- objeo-native-preview://auth/callback
- objeo-native-preview://auth/confirm
- objeo-native-preview://auth/recovery
- objeo://auth/callback
- objeo://auth/confirm
- objeo://auth/recovery
Conserver les URLs web existantes. Tester confirmation et récupération sur l'appareil initiant le flux; les liens PKCE dépendent du vérificateur de cet appareil. La migration du stockage impose une reconnexion des comptes de l'ancien aperçu. Google utilise le navigateur système uniquement pour OAuth.

## Production — ne pas publier avant recette
Vérifier dans Play Console l'identifiant **exact** (online.objeo.app ou online.objeo.twa) et la version la plus haute, puis définir OBJEO_PLAY_PACKAGE, OBJEO_PLAY_VERSION_CODE (> version publiée), OBJEO_PLAY_VERSION dans l'environnement du profil production EAS, et utiliser la clé d'importation déjà associée à la fiche. OBJEO_RELEASE=1 est activé par ce profil. Aucun secret de signature ne doit être commité. Ne pas interrompre le test fermé actuel. Une version différente doit être testée avant publication.

## Périmètre et limites
Écrans natifs : authentification, recherche PostGIS, photo/caméra, annonces, messagerie, favoris locaux, restitutions, objets personnels, partenaires et espace pro. Les écrans sont à valider sur appareil avec deux comptes de test; la recherche des annonces pro passe par l'annuaire. Centre de notifications, recherche intelligente textuelle, compteurs de messages récents, panier natif et commandes Stripe sont codés. Le paiement Stripe réel est désactivé dans l'aperçu; il faut OBJEO_ENABLE_LIVE_CHECKOUT=1 dans le profil de production ET le réglage serveur actif, après recette. L'écran Stripe hébergé s'ouvre dans le navigateur système; seuls les statuts serveur confirment les paiements. Notifications push FCM, IA photo, favoris synchronisés et parité complète Pro restent à finaliser. Les contrats/rétractation de commande et la suppression du compte utilisent des liens web. Google nécessite l'allowlist Supabase. Faire les tests de confidentialité, autorisations, modération et sécurité avant commercialisation. Le site et la base n'ont pas été modifiés.

## Connexion Google native et écrans légaux
Le bouton Google appelle un module Kotlin local utilisant Android Credential Manager, sans OAuth navigateur. Le nonce aléatoire est haché SHA-256 pour Google et envoyé brut à Supabase signInWithIdToken. Conserver la vérification du nonce activée. L'identifiant OAuth Web public historique est configuré via app.config.js (surcharge OBJEO_GOOGLE_WEB_CLIENT_ID). Ajouter dans Google Cloud un client OAuth Android pour le package exact et SHA-1 du certificat (fichier android-signing-certificate.txt dans l'artefact CI). Pour Play, utiliser le certificat de signature d'application Play et non uniquement la clé d'importation. Les services Google Play et un compte Google sont nécessaires; un émulateur sans ces services peut échouer. Les liens de confirmation/récupération par e-mail gardent le parcours PKCE. CGU, confidentialité, CGV, suppression et documents/rétractation de commandes s'affichent en natif; la demande de suppression ouvre explicitement le logiciel de messagerie (envoi manuel existant). Les textes juridiques reprennent les pages du dépôt; CGU/confidentialité restent provisoires et la confidentialité contient des mentions de ventes fermées à actualiser avant publication. Stripe Checkout reste hébergé par Stripe, sans collecte de carte par Objeo. Les tests fonctionnels restent nécessaires.

## Espace professionnel étendu
Création du compte établissement, coordonnées publiques, QR généré localement, impression, équipe via RPC propriétaire et bascule entre établissements autorisés. Les droits restent définis par RLS; vérifier sur comptes distincts avant publication. Favoris et demandes de suppression utilisent le SQL additionnel mobile/backend/account-and-favorites.sql (appliqué en production, RLS contrôlée). La suppression effective reste manuelle.

## Analyse photo native
ML Kit intégré (modèle embarqué 17.0.9), comparaison d'étiquettes, couleurs et empreintes d'image, sans envoi de la photo personnelle au serveur. Résultats indicatifs parmi 16 photos d'annonces trouvées dans 50 km; ne garantit pas la reconnaissance de l'objet. Les correspondances de la surveillance d'objets personnels utilisent aussi le moteur Supabase existant et ses scores visuels.

## Checklist production (à effectuer avant diffusion)
- Google Cloud : créer client OAuth Android pour le package exact et SHA-1 de signature Play, garder le client Web Supabase et le contrôle du nonce. Tester Google et l'e-mail sur un appareil Android avec services Google Play.
- Firebase : enregistrer les packages de test et/ou production, fournir le fichier google-services.json via OBJEO_GOOGLE_SERVICES_FILE (configuration client). Ne jamais mettre une clé privée serveur dans le dépôt ou le binaire. Dans Supabase Edge Function Secrets, renseigner OBJEO_FCM_SERVICE_ACCOUNT_JSON (compte de service FCM à privilèges minimaux) et OBJEO_NATIVE_PUSH_WORKER_SECRET (secret aléatoire). Déployer le worker puis planifier une invocation authentifiée POST toutes les minutes avec secret via un ordonnanceur sécurisé. Worker déjà déployé, sans secret ni planification vérifiés. Vérifier messages, pro, correspondances, restitution sur deux comptes. SQL native-push.sql puis native-push-events.sql déjà appliqués; aucune modification des triggers web.
- AdMob : créer l'application Android et un bloc bannière, configurer la CMP Google pour l'EEE/Royaume-Uni/Suisse. Vérifier que le site/app-ads.txt est correct pour AdMob. En production : OBJEO_ENABLE_ADS=1, OBJEO_ADMOB_APP_ID et OBJEO_ADMOB_BANNER_ID. En aperçu : OBJEO_TEST_ADS=1 uniquement pour annonces de test. L'interface attend UMP avant d'initialiser les publicités et demande des annonces non personnalisées; valider consentement/retrait en conditions réelles. Publicité réelle désactivée par défaut.
- Stripe : tester panier et reprise après interruption, stock et montant côté serveur, consentement CGV, paiement, annulation et remboursement via environnement de test séparé. Ne jamais activer le mode réel dans un aperçu. Checkout Stripe hébergé conservé volontairement.
- Suppression du compte : les demandes in-app sont enregistrées dans public.objeo_account_deletion_requests. Le responsable doit traiter régulièrement cette file, vérifier l'identité, supprimer/anonymiser compte et données selon les obligations de conservation, puis confirmer au demandeur; prévoir un accusé par e-mail. Aucune suppression automatique irréversible. Vérifier CGU, politique de confidentialité et déclaration sécurité des données (authentification, photos, localisation, messages, publicité, paiement), et corriger les mentions provisoires contradictoires avant publication.
- Google Play : vérifier package existant, code de version, certificat d'application Play et clé d'importation, conserver le test fermé actuel. Générer AAB via profil production EAS, après configuration des identifiants et signature. Le certificat de test Expo public n'est JAMAIS une clé de production. Vérifier aussi les liens HTTPS, le partage, les permissions, les parcours sans réseau et les tests de restauration/reconnexion. Ne publier qu'après validation réelle de la recette.

## Firebase aperçu
La configuration cliente Android du projet objeo-515101 est intégrée pour online.objeo.nativepreview. Elle ne contient pas de clé privée serveur. Les builds de production nécessitent un fichier correspondant à leur propre package, fourni via OBJEO_GOOGLE_SERVICES_FILE. Restreindre la clé API cliente aux API Firebase nécessaires et vérifier les restrictions compatibles avec l'application. L'authentification Supabase conserve son client OAuth Web existant, indépendamment du client Web auto-généré dans la configuration Firebase. La réception FCM nécessite encore le compte de service côté serveur et le déclenchement sécurisé du worker. AdMob est épinglé à react-native-google-mobile-ads 16.0.2 (SDK Android 24.6.0) pour éviter l'incompatibilité des métadonnées Kotlin 2.3 du SDK 25.4.0 avec Expo 55/Kotlin 2.1.
