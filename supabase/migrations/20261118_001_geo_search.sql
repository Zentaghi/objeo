-- Objeo | Migration 001 : recherche geographique PostGIS
-- A executer dans Supabase SQL Editor apres sauvegarde du schema.
-- Ne touche ni a ad_private, ni aux coordonnees privees.
-- Les annonces sans coordonnees approximatives restent accessibles via recherche sans rayon.

begin;

create extension if not exists postgis with schema extensions;

-- Colonne geographique derivee des positions PUBLIQUES approximatives.
alter table public.ads
  add column if not exists search_location extensions.geography(Point,4326);

-- Backfill des annonces existantes. Coordonnees GPS: lon = X, lat = Y.
update public.ads
set search_location = case
  when approx_lat between -90 and 90 and approx_lon between -180 and 180
  then extensions.ST_SetSRID(extensions.ST_MakePoint(approx_lon,approx_lat),4326)::extensions.geography
  else null
end
where search_location is distinct from case
  when approx_lat between -90 and 90 and approx_lon between -180 and 180
  then extensions.ST_SetSRID(extensions.ST_MakePoint(approx_lon,approx_lat),4326)::extensions.geography
  else null
end;

-- Maintien automatique pour toute nouvelle annonce et modification de localisation.
create or replace function public.objeo_sync_search_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.approx_lat between -90 and 90 and new.approx_lon between -180 and 180 then
    new.search_location :=
      extensions.ST_SetSRID(extensions.ST_MakePoint(new.approx_lon,new.approx_lat),4326)::extensions.geography;
  else
    new.search_location := null;
  end if;
  return new;
end;
$$;

drop trigger if exists objeo_ads_location_sync on public.ads;
create trigger objeo_ads_location_sync
before insert or update of approx_lat, approx_lon
on public.ads
for each row execute function public.objeo_sync_search_location();

create index if not exists objeo_ads_search_location_gix
  on public.ads using gist (search_location)
  where status = 'open';

create index if not exists objeo_ads_open_created_idx
  on public.ads (created_at desc, id)
  where status = 'open';

-- RPC a colonnes explicites : ne retourne jamais ad_private ni une adresse exacte.
-- SECURITY INVOKER respecte les politiques RLS existantes sur ads.
create or replace function public.search_ads_nearby(
  p_lat double precision default null,
  p_lon double precision default null,
  p_radius_m integer default 20000,
  p_query text default null,
  p_category text default null,
  p_kind text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid,
  kind text,
  title text,
  category text,
  description text,
  city text,
  happened_on date,
  photo_path text,
  created_at timestamptz,
  distance_m double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with args as (
    select
      case when p_lat between -90 and 90 and p_lon between -180 and 180
        then extensions.ST_SetSRID(extensions.ST_MakePoint(p_lon,p_lat),4326)::extensions.geography
        else null end as origin,
      least(greatest(coalesce(p_radius_m,20000),0),500000) as radius_m,
      nullif(trim(coalesce(p_query,'')),'') as q,
      nullif(trim(coalesce(p_category,'')),'') as category,
      nullif(trim(coalesce(p_kind,'')),'') as kind,
      least(greatest(coalesce(p_limit,30),1),100) as page_size,
      greatest(coalesce(p_offset,0),0) as page_offset
  )
  select a.id, a.kind::text, a.title::text, a.category::text,
         a.description::text, a.city::text, a.happened_on,
         a.photo_path::text, a.created_at,
         case when args.origin is not null and a.search_location is not null
           then extensions.ST_Distance(a.search_location,args.origin)
           else null end as distance_m
  from public.ads a cross join args
  where a.status = 'open'
    and (args.kind is null or a.kind = args.kind)
    and (args.category is null or a.category = args.category)
    and (args.q is null or
      concat_ws(' ',a.title,a.description,a.category,a.city) ilike '%' || args.q || '%')
    and (args.origin is null or (
      a.search_location is not null
      and extensions.ST_DWithin(a.search_location,args.origin,args.radius_m)
    ))
  order by
    case when args.origin is not null and a.search_location is not null
      then extensions.ST_Distance(a.search_location,args.origin) end asc nulls last,
    a.created_at desc,
    a.id
  limit (select page_size from args)
  offset (select page_offset from args);
$$;

-- L'acces aux donnees est toujours soumis aux RLS de public.ads.
revoke all on function public.search_ads_nearby(
  double precision,double precision,integer,text,text,text,integer,integer
) from public;
grant execute on function public.search_ads_nearby(
  double precision,double precision,integer,text,text,text,integer,integer
) to anon, authenticated;

commit;

-- TEST APRES EXECUTION :
-- select id, title, city, round(distance_m::numeric) as metres
-- from public.search_ads_nearby(48.8566,2.3522,20000,null,null,null,30,0);
