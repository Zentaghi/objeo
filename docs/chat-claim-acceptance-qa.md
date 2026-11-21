# Recette de la nouvelle messagerie Objeo

## Dépendances Supabase

À exécuter dans le **bon projet Supabase** via SQL Editor, avec un rôle administrateur :

1. `supabase/migrations/20261121_accepted_claim_contact.sql` (si elle n'est pas déjà appliquée).
2. `supabase/migrations/20261121_chat_read_receipts_optional_phone.sql`.

Vérifier avant exécution que les identifiants de `conversations`, `ads` et `objeo_claims` sont de type UUID. Les migrations GitHub ne sont **pas** automatiquement appliquées à la base de production.

## Recette à deux comptes

- A publie un objet trouvé, B clique **Contacter** et envoie un message.
- A ouvre Mes messages : le compteur de non-lus apparaît sur mobile / navigation et dans le profil. Une heure et une date s'affichent sous chaque message.
- A lit la discussion : le compteur disparaît pour les messages lus.
- B ouvre la discussion et utilise **Revendiquer cet objet**, puis soumet la preuve.
- A voit le statut **En attente** et la preuve dans la conversation ; il peut accepter ou refuser.
- Tester le refus : aucune adresse e-mail ni téléphone n'est révélé au revendiquant.
- Tester l'acceptation : l'e-mail de A (si la RPC précédente existe) apparaît pour B. Un numéro ne s'affiche que si A l'a saisi et a explicitement coché l'option dans **Profil → Coordonnées de restitution**.
- A peut désactiver le partage de son téléphone en revenant dans son profil.
- Après acceptation, B peut utiliser un lien mailto: ou tel: pour organiser la remise directement.
- Tester qu'un troisième compte ne peut consulter ni la conversation ni les coordonnées privées.
- Tester l'affichage « Membre Objeo » lorsque le profil n'a pas de nom et le badge PRO si l'interlocuteur est propriétaire d'un établissement.
- Tester depuis Safari iPhone, Android et ordinateur, ainsi qu'avec une connexion interrompue.

## Limites

- Le compteur s'actualise toutes les 25 secondes lorsque le site est ouvert, et au retour sur l'onglet ; il ne constitue pas une notification push iOS/Android lorsque le site est fermé.
- Une installation Supabase ou une politique RLS incorrecte peut empêcher les notifications et la divulgation autorisée des coordonnées.
- Les tests statiques sont ajoutés ; la recette réelle avec deux comptes et la migration SQL restent à accomplir.
- Le système de restitution garde ses règles existantes : acceptation d'une revendication **≠** confirmation de remise de l'objet.
