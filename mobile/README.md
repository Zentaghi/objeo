# Objeo — application Android React Native (aperçu)
Projet distinct du site web, sans WebView ni Trusted Web Activity. Branche android-native uniquement. La base Supabase existante est utilisée via sa clé publique; aucune migration SQL.

## Exécuter sur un émulateur
Node 20.19+ ou 22, JDK 17, Android Studio et SDK Android. Depuis la racine du dépôt:
```sh
git switch android-native
cd mobile
npm install
npx expo install --check
npx expo-doctor
npm run android
```
Le premier npm install doit générer package-lock.json; vérifier et commiter le lockfile avant de distribuer. SDK 55 choisi comme base documentée, pas comme dernière version. Les dépendances et la compilation n'ont pas encore été testées.

## APK de prévisualisation
Après configuration d'un compte Expo/EAS, depuis mobile: npx eas-cli build --platform android --profile preview.
Identifiant temporaire online.objeo.nativepreview pour installer en parallèle de la PWA. Ne pas importer cet APK dans la fiche Play existante.

## Périmètre initial
Interface native, connexion/inscription email, sessions persistantes, vérification du type de compte, lecture des annonces ouvertes, filtres simples ville/type/texte, détails, partage, mes annonces, déconnexion. Les professionnels sont orientés vers leur espace existant, non vers l'espace particulier. Les données réelles sont lues sans modifier la base; utiliser un compte de test.

## À terminer avant tout AAB de remplacement
- Vérifier les dépendances, lockfile, compilation et tests sur Android; renforcer stockage des sessions (Keystore).
- Connexion Google et liens profonds, confirmation et récupération de compte.
- Publication avec photos, GPS et recherche PostGIS complète (rayon, catégories, pagination).
- Messagerie temps réel, revendications, restitutions, favoris, objets personnels, IA, espace pro.
- Notifications Android FCM/Expo: nouveau stockage des jetons et envoi serveur, sans remplacer le Web Push existant.
- Boutique physique Stripe, suppression du compte, signalements, modération, déclarations Play.
- Contrôler icône ronde et splash valise sur un APK release.
- Vérifier le package EXACT dans Play Console, la clé d'importation existante et le versionCode actuel. Configurer ensuite un profil release AAB avec le même package et un versionCode supérieur. Ne jamais déposer la clé de signature ou son mot de passe dans GitHub.
- Ne pas interrompre le test fermé actuel; faire la mise à jour seulement après recette complète.

## Migration native — lot 2
Publication photo/caméra, recherche RPC PostGIS avec pagination et GPS, favoris locaux, détail et partage, messagerie et revendication, fermeture auteur, objets personnels, annuaire des partenaires et premiers écrans professionnels. Google OAuth nécessite d'ajouter la redirection exacte `objeo-native-preview://auth/callback` dans Supabase Auth et de tester sur un appareil. La recherche pro passe pour le moment par l'annuaire; pas encore fusionnée avec les annonces personnelles. La réception et la décision des demandes côté propriétaire (particuliers et professionnels) sont également codées; les compteurs non lus, les notifications FCM, IA et boutique native restent à finir. Aucun changement de base de production. L'installation npm ajoute un correctif Foojay idempotent. Utiliser un JDK complet et Node 22. Après mise à jour des dépendances, reconstruire le binaire Android. Les écrans sont codés mais non compilés/testés ici.
