-- Objeo: public poster display name; private email only after an accepted claim.
create or replace function public.objeo_poster_name(p_ad_id text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')), ''), 'Membre Objeo')
  from public.ads a join auth.users u on u.id = a.user_id
  where a.id::text = p_ad_id
  limit 1;
$$;
revoke all on function public.objeo_poster_name(text) from public;
grant execute on function public.objeo_poster_name(text) to anon, authenticated;

create or replace function public.objeo_accepted_claim_contact(p_claim_id uuid)
returns table (poster_name text, poster_email text)
language sql stable security definer
set search_path = ''
as $$
  select
    coalesce(nullif(trim(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','')), ''),'Membre Objeo'),
    u.email::text
  from public.objeo_claims c
  join public.ads a on a.id = c.ad_id
  join auth.users u on u.id = a.user_id
  where c.id = p_claim_id
    and c.status = 'accepted'
    and c.claimant_id = (select auth.uid())
  limit 1;
$$;
revoke all on function public.objeo_accepted_claim_contact(uuid) from public, anon;
grant execute on function public.objeo_accepted_claim_contact(uuid) to authenticated;
