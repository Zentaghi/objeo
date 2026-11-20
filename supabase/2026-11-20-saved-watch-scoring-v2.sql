-- Objeo watch scoring v2. Run AFTER 2026-11-20-saved-object-watch.sql.
-- Scores describe text/location agreement only; NOT image recognition or ownership proof.
alter table public.objeo_saved_object_matches add column if not exists match_score integer;
alter table public.objeo_saved_object_matches add column if not exists match_reasons text[] not null default '{}';
create or replace function public.objeo_watch_saved_objects()
returns trigger language plpgsql security definer set search_path=''
as $$
declare candidate record; score integer; reasons text[]; title_hits integer; description_hits integer;
begin
 if new.kind is distinct from 'found' or new.status is distinct from 'open' then return new; end if;
 for candidate in
  select s.id,s.owner_id,s.title,s.description,s.category,s.city
  from public.objeo_saved_objects s
  where s.owner_id<>new.user_id
    and nullif(trim(s.city),'') is not null
    and lower(trim(s.city))=lower(trim(coalesce(new.city,'')))
  limit 500
 loop
  score:=20; reasons:=array['Même ville'];
  if nullif(trim(candidate.category),'') is not null
     and lower(trim(candidate.category))=lower(trim(coalesce(new.category,''))) then
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
  if title_hits>0 and score>=55 then
   insert into public.objeo_saved_object_matches(owner_id,saved_object_id,found_ad_id,match_score,match_reasons)
   values(candidate.owner_id,candidate.id,new.id,least(score,100),reasons)
   on conflict(saved_object_id,found_ad_id) do update
     set match_score=excluded.match_score,match_reasons=excluded.match_reasons;
  end if;
 end loop;
 return new;
end $$;
-- Existing trigger on public.ads already invokes this function.
-- No private inventory data is exposed to ad authors or anonymous visitors.
