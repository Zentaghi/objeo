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
Écrans natifs : authentification, recherche PostGIS, photo/caméra, annonces, messagerie, favoris locaux, restitutions, objets personnels, partenaires et espace pro. Les écrans sont à valider sur appareil avec deux comptes de test; la recherche des annonces pro passe par l'annuaire. Notifications FCM et intégration serveur, IA photo, favoris synchronisés, compteurs de messages, boutique native et Stripe ne sont pas finalisés. Boutique et suppression du compte utilisent actuellement des liens web. Google nécessite l'allowlist Supabase. Faire les tests de confidentialité, autorisations, modération et sécurité avant commercialisation. Le site et la base n'ont pas été modifiés.
