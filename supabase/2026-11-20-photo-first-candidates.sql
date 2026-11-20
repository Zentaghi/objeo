-- Objeo: photo-first candidates + retroactive matching for recent found ads.
-- Run AFTER saved-watch-scoring-v2.sql and saved-watch-image-scoring.sql.
-- Image candidates require SAME city + SAME nonempty category + both photos.
-- Their score remains provisional until the private image worker processes them.
create or replace function public.objeo_watch_saved_objects()
returns trigger language plpgsql security definer set search_path=''
as $$
declare candidate record; score integer; reasons text[]; title_hits integer; description_hits integer; photo_candidate boolean;
begin
 if new.kind is distinct from 'found' or new.status is distinct from 'open' then return new; end if;
 for candidate in
  select s.id,s.owner_id,s.title,s.description,s.category,s.city,s.photo_path
  from public.objeo_saved_objects s
  where s.owner_id<>new.user_id
    and nullif(trim(s.city),'') is not null
    and lower(trim(s.city))=lower(trim(coalesce(new.city,'')))
  limit 500
 loop
  score:=20; reasons:=array['Même ville'];
  if nullif(trim(candidate.category),'') is not null
     and (lower(trim(candidate.category))=lower(trim(coalesce(new.category,''))) or (length(trim(candidate.category))>=3 and length(trim(coalesce(new.category,'')))>=3 and (lower(trim(candidate.category)) like lower(trim(coalesce(new.category,'')))||' et %' or lower(trim(coalesce(new.category,''))) like lower(trim(candidate.category))||' et %'))) then
    score:=score+25; reasons:=array_append(reasons,'Même catégorie');
  end if;
  select count(*) into title_hits from (
   select distinct word from regexp_split_to_table(lower(coalesce(candidate.title,'')),'[^[:alnum:]]+') word
   where length(word)>=4 and word not in ('avec','pour','dans','noir','noire','blanc','blanche','petit','petite','grand','grande','objet','trouve','perdu')
  ) w where lower(coalesce(new.title,'')||' '||coalesce(new.description,'')) like '%'||w.word||'%';
  if title_hits>0 then
   score:=score+least(45,25+10*(title_hits-1));
   reasons:=array_append(reasons,'Mots du nom similaires');
  end if;
  select count(*) into description_hits from (
   select distinct word from regexp_split_to_table(lower(coalesce(candidate.description,'')),'[^[:alnum:]]+') word
   where length(word)>=5 and word not in ('avec','pour','dans','noir','noire','blanc','blanche','petit','petite','grand','grande','objet','trouve','perdu')
  ) w where lower(coalesce(new.title,'')||' '||coalesce(new.description,'')) like '%'||w.word||'%';
  if description_hits>0 then
   score:=score+least(10,5*description_hits);
   reasons:=array_append(reasons,'Détails similaires');
  end if;
  photo_candidate:=nullif(candidate.photo_path,'') is not null
    and nullif(new.photo_path,'') is not null
    and nullif(trim(candidate.category),'') is not null
    and (lower(trim(candidate.category))=lower(trim(coalesce(new.category,''))) or (length(trim(candidate.category))>=3 and length(trim(coalesce(new.category,'')))>=3 and (lower(trim(candidate.category)) like lower(trim(coalesce(new.category,'')))||' et %' or lower(trim(coalesce(new.category,''))) like lower(trim(candidate.category))||' et %')));
  if (title_hits>0 and score>=55) or photo_candidate then
   if photo_candidate and title_hits=0 then
    reasons:=array_append(reasons,'Photos à comparer (résultat provisoire)');
   end if;
   insert into public.objeo_saved_object_matches(owner_id,saved_object_id,found_ad_id,match_score,match_reasons)
   values(candidate.owner_id,candidate.id,new.id,least(score,100),reasons)
   on conflict(saved_object_id,found_ad_id) do nothing;
  end if;
 end loop;
 return new;
end $$;

-- Backfill photo candidates for recent found ads (last 7 days).
-- Caution: inserts can invoke the configured email webhook.
insert into public.objeo_saved_object_matches(owner_id,saved_object_id,found_ad_id,match_score,match_reasons)
select s.owner_id,s.id,a.id,45,array['Même ville','Même catégorie','Photos à comparer (résultat provisoire)']::text[]
from public.objeo_saved_objects s
join public.ads a on a.kind='found' and a.status='open'
  and a.created_at>=now()-interval '7 days'
  and a.user_id<>s.owner_id
  and lower(trim(a.city))=lower(trim(s.city))
  and (lower(trim(a.category))=lower(trim(s.category)) or (length(trim(a.category))>=3 and length(trim(s.category))>=3 and (lower(trim(a.category)) like lower(trim(s.category))||' et %' or lower(trim(s.category)) like lower(trim(a.category))||' et %')))
where nullif(trim(s.city),'') is not null
  and nullif(trim(s.category),'') is not null
  and nullif(s.photo_path,'') is not null
  and nullif(a.photo_path,'') is not null
on conflict(saved_object_id,found_ad_id) do nothing;
