-- Objeo: autoriser le statut 'returned' sans supprimer les statuts existants.
-- À exécuter dans Supabase SQL Editor AVANT de retenter la confirmation.
-- Cette migration ne modifie ni ne supprime les annonces.
begin;
do $$
declare
  v_definition text;
  v_expression text;
begin
  select pg_get_constraintdef(c.oid)
    into v_definition
  from pg_constraint c
  join pg_class t on t.oid=c.conrelid
  join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='ads'
    and c.conname='ads_status_check' and c.contype='c';

  if v_definition is null then
    raise exception 'Contrainte public.ads.ads_status_check introuvable : vérifiez le schéma avant modification';
  end if;
  -- pg_get_constraintdef returns CHECK (<expression>).
  v_expression := substring(v_definition from '^CHECK \\((.*)\\)$');
  if v_expression is null then
    raise exception 'Définition inattendue de ads_status_check : %',v_definition;
  end if;
  execute 'alter table public.ads drop constraint ads_status_check';
  execute 'alter table public.ads add constraint ads_status_check check ((' ||
          v_expression || ') or status = ''returned'')';
end $$;
commit;
