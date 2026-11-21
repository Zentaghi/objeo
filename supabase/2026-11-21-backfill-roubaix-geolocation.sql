-- Répare les annonces déjà publiées à Roubaix sans coordonnées de recherche.
-- Centre approximatif de Roubaix (pas une adresse privée).
-- Ne modifie que les annonces ouvertes sans latitude ou longitude.
begin;
update public.ads
set approx_lat = 50.6927,
    approx_lon = 3.1746
where status = 'open'
  and lower(trim(city)) = 'roubaix'
  and (approx_lat is null or approx_lon is null);
commit;
-- Vérification :
select id, title, city, status, approx_lat, approx_lon
from public.ads
where lower(trim(city)) = 'roubaix'
order by created_at desc
limit 30;
