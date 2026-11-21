-- Objeo: correction de ads_status_check.
-- Définition constatée dans Supabase : CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text])))
-- Conserve les valeurs actuelles et ajoute 'returned' pour les restitutions.
-- Aucun enregistrement n'est modifié ou supprimé.
begin;
alter table public.ads drop constraint if exists ads_status_check;
alter table public.ads add constraint ads_status_check
  check (status in ('open', 'resolved', 'returned'));
commit;
