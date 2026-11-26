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
