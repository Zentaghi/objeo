-- Objeo geographical matching (phase 1).
-- Run AFTER 2026-11-20-photo-first-candidates.sql.
-- Coordinates are city CENTROIDS, never a user's precise address.
-- Existing rows without coordinates keep exact-city matching.
alter table public.objeo_saved_objects add column if not exists city_lat double precision;
alter table public.objeo_saved_objects add column if not exists city_lon double precision;
alter table public.objeo_saved_objects add column if not exists search_radius_km integer not null default 25;
alter table public.ads add column if not exists city_lat double precision;
alter table public.ads add column if not exists city_lon double precision;
alter table public.objeo_saved_object_matches add column if not exists distance_km numeric(8,1);
alter table public.objeo_saved_objects drop constraint if exists objeo_saved_radius_valid;
alter table public.objeo_saved_objects add constraint objeo_saved_radius_valid check (search_radius_km in (5,10,25,50,100));
alter table public.objeo_saved_objects drop constraint if exists objeo_saved_coords_valid;
alter table public.objeo_saved_objects add constraint objeo_saved_coords_valid check (
(city_lat is null and city_lon is null) or
(city_lat between -90 and 90 and city_lon between -180 and 180));
alter table public.ads drop constraint if exists objeo_ads_city_coords_valid;
alter table public.ads add constraint objeo_ads_city_coords_valid check (
(city_lat is null and city_lon is null) or
(city_lat between -90 and 90 and city_lon between -180 and 180));

create or replace function public.objeo_city_distance_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable strict set search_path=''
as $$
select 6371.0088 * 2 * asin(sqrt(least(1.0,
  power(sin(radians(lat2-lat1)/2),2)
  + cos(radians(lat1))*cos(radians(lat2))*power(sin(radians(lon2-lon1)/2),2)
)));
$$;

-- Candidates can be matched by city coordinates when both cities are geocoded.
-- Until both sides are geocoded, same-city matching remains the fallback.
create or replace function public.objeo_watch_saved_objects()
returns trigger language plpgsql security definer set search_path=''
as $$
declare candidate record; score integer; reasons text[]; title_hits integer; description_hits integer; photo_candidate boolean; km double precision; nearby boolean; category_ok boolean;
begin
 if new.kind is distinct from 'found' or new.status is distinct from 'open' then return new; end if;
 for candidate in
  select s.id,s.owner_id,s.title,s.description,s.category,s.city,s.photo_path,
         s.city_lat,s.city_lon,s.search_radius_km
  from public.objeo_saved_objects s
  where s.owner_id<>new.user_id and nullif(trim(s.city),'') is not null
  limit 500
 loop
  km:=null;
  if candidate.city_lat is not null and candidate.city_lon is not null
    and new.city_lat is not null and new.city_lon is not null then
    km:=public.objeo_city_distance_km(candidate.city_lat,candidate.city_lon,new.city_lat,new.city_lon);
    nearby:=km<=candidate.search_radius_km;
  else
    nearby:=lower(trim(candidate.city))=lower(trim(coalesce(new.city,'')));
  end if;
  if not nearby then continue; end if;
  score:=20;
  reasons:=array[case when km is null then 'Même ville' else 'Distance approximative entre villes' end];
  category_ok:=nullif(trim(candidate.category),'') is not null and
    (lower(trim(candidate.category))=lower(trim(coalesce(new.category,'')))
    or (length(trim(candidate.category))>=3 and length(trim(coalesce(new.category,'')))>=3
      and (lower(trim(candidate.category)) like lower(trim(coalesce(new.category,'')))||' et %'
      or lower(trim(coalesce(new.category,''))) like lower(trim(candidate.category))||' et %')));
  if category_ok then score:=score+25;reasons:=array_append(reasons,'Catégories compatibles');end if;
  select count(*) into title_hits from (
   select distinct word from regexp_split_to_table(lower(coalesce(candidate.title,'')),'[^[:alnum:]]+') word
   where length(word)>=4 and word not in ('avec','pour','dans','noir','noire','blanc','blanche','petit','petite','grand','grande','objet','trouve','perdu')
  ) w where lower(coalesce(new.title,'')||' '||coalesce(new.description,'')) like '%'||w.word||'%';
  if title_hits>0 then score:=score+least(45,25+10*(title_hits-1));reasons:=array_append(reasons,'Mots du nom similaires');end if;
  select count(*) into description_hits from (
   select distinct word from regexp_split_to_table(lower(coalesce(candidate.description,'')),'[^[:alnum:]]+') word
   where length(word)>=5 and word not in ('avec','pour','dans','noir','noire','blanc','blanche','petit','petite','grand','grande','objet','trouve','perdu')
  ) w where lower(coalesce(new.title,'')||' '||coalesce(new.description,'')) like '%'||w.word||'%';
  if description_hits>0 then score:=score+least(10,5*description_hits);reasons:=array_append(reasons,'Détails similaires');end if;
  photo_candidate:=candidate.photo_path is not null and new.photo_path is not null and category_ok;
  if (title_hits>0 and score>=55) or photo_candidate then
    if photo_candidate and title_hits=0 then reasons:=array_append(reasons,'Photos à comparer (résultat provisoire)');end if;
    insert into public.objeo_saved_object_matches(owner_id,saved_object_id,found_ad_id,match_score,match_reasons,distance_km)
    values(candidate.owner_id,candidate.id,new.id,least(score,100),reasons,case when km is null then null else round(km::numeric,1) end)
    on conflict(saved_object_id,found_ad_id) do nothing;
  end if;
 end loop;
 return new;
end $$;

-- This migration deliberately does not fabricate coordinates for existing rows.
-- Next phase: geocode cities from a verified municipality API at write time,
-- then backfill existing city coordinates and recent matches.
