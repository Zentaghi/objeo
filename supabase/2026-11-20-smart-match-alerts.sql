-- Objeo: reduce false-positive match alerts.
-- Execute AFTER 2026-11-20-security-claims-match-alerts.sql.
-- Only open ads of opposite kinds, different owners, same nonempty category.
-- Location: <= 30km with public approximate coordinates; otherwise same city.
-- Do not expose precise coordinates or contact details.
create or replace function public.objeo_notify_potential_matches()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare other_ad record; lost_id uuid; found_id uuid; recipient uuid;
begin
 if new.status is distinct from 'open' or new.kind not in ('lost','found') then return new; end if;
 if nullif(trim(coalesce(new.category,'')),'') is null then return new; end if;
 for other_ad in
  select a.id,a.user_id
  from public.ads a
  where a.id<>new.id and a.status='open'
    and a.kind=case when new.kind='lost' then 'found' else 'lost' end
    and a.user_id<>new.user_id
    and lower(trim(a.category))=lower(trim(new.category))
    and (
      (a.search_location is not null and new.search_location is not null
       and extensions.ST_DWithin(a.search_location,new.search_location,30000))
      or ((a.search_location is null or new.search_location is null)
       and nullif(trim(coalesce(a.city,'')),'') is not null
       and lower(trim(a.city))=lower(trim(new.city)))
    )
  order by a.created_at desc limit 20
 loop
  if new.kind='lost' then lost_id:=new.id;found_id:=other_ad.id;recipient:=new.user_id;
  else lost_id:=other_ad.id;found_id:=new.id;recipient:=other_ad.user_id;end if;
  insert into public.objeo_match_notifications(recipient_id,lost_ad_id,found_ad_id)
  values(recipient,lost_id,found_id) on conflict do nothing;
 end loop;
 return new;
end $$;
-- Only an insert trigger is required: no retroactive notification storm.
-- CLIP image similarity still runs in the browser when a user opens matching results.
