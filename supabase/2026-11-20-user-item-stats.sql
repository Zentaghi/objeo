-- Objeo: preserve restitution statistics when an ad is removed.
-- Run in Supabase SQL Editor. Historical deleted ads cannot be reconstructed.
create table if not exists public.objeo_user_item_stats (
 user_id uuid primary key references auth.users(id) on delete cascade,
 found_published integer not null default 0 check(found_published>=0),
 returned_count integer not null default 0 check(returned_count>=0),
 updated_at timestamptz not null default now()
);
alter table public.objeo_user_item_stats enable row level security;
drop policy if exists "read own item stats" on public.objeo_user_item_stats;
create policy "read own item stats" on public.objeo_user_item_stats for select to authenticated using(user_id=auth.uid());
-- Seed all existing published found ads before enabling triggers.
insert into public.objeo_user_item_stats(user_id,found_published)
select user_id,count(*)::integer from public.ads where kind='found' group by user_id
on conflict(user_id) do update set found_published=greatest(public.objeo_user_item_stats.found_published,excluded.found_published);
create or replace function public.objeo_item_stats_insert() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.kind='found' then
 insert into public.objeo_user_item_stats(user_id,found_published,updated_at) values(new.user_id,1,now())
 on conflict(user_id) do update set found_published=objeo_user_item_stats.found_published+1,updated_at=now();
 end if;
 return new;
end $$;
drop trigger if exists objeo_item_stats_on_insert on public.ads;
create trigger objeo_item_stats_on_insert after insert on public.ads for each row execute function public.objeo_item_stats_insert();
-- Deletion is not evidence of restitution. Record only explicit user-confirmed returns.
create or replace function public.objeo_mark_returned(p_ad_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_ad record;
begin
 select id,user_id,kind into v_ad from public.ads where id=p_ad_id for update;
 if not found then raise exception 'Annonce introuvable'; end if;
 if auth.uid() is null or auth.uid()<>v_ad.user_id then raise exception 'Accès refusé'; end if;
 if v_ad.kind<>'found' then raise exception 'Seuls les objets trouvés peuvent être restitués'; end if;
 insert into public.objeo_user_item_stats(user_id,returned_count,updated_at) values(v_ad.user_id,1,now())
 on conflict(user_id) do update set returned_count=objeo_user_item_stats.returned_count+1,updated_at=now();
 delete from public.ads where id=p_ad_id;
end $$;
revoke all on function public.objeo_mark_returned(uuid) from public;
grant execute on function public.objeo_mark_returned(uuid) to authenticated;
