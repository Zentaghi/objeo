-- Objeo: reports, ownership claims and private in-app match notifications.
-- Run in Supabase SQL Editor. No email is sent by this migration.
create table if not exists public.objeo_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 ad_id uuid not null references public.ads(id) on delete cascade,
 reason text not null check(reason in ('fraud','spam','inappropriate','privacy','other')),
 details text check(length(details)<=1000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now(),
 unique(reporter_id,ad_id)
);
alter table public.objeo_reports enable row level security;
drop policy if exists "reporter can create reports" on public.objeo_reports;
create policy "reporter can create reports" on public.objeo_reports for insert to authenticated with check(reporter_id=auth.uid() and status='pending');
drop policy if exists "reporter can see own reports" on public.objeo_reports;
create policy "reporter can see own reports" on public.objeo_reports for select to authenticated using(reporter_id=auth.uid());
create table if not exists public.objeo_claims (
 id uuid primary key default gen_random_uuid(),
 ad_id uuid not null references public.ads(id) on delete cascade,
 claimant_id uuid not null references auth.users(id) on delete cascade,
 evidence text not null check(length(evidence) between 20 and 1500),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 unique(ad_id,claimant_id)
);
alter table public.objeo_claims enable row level security;
drop policy if exists "claimants submit claims" on public.objeo_claims;
create policy "claimants submit claims" on public.objeo_claims for insert to authenticated with check(claimant_id=auth.uid() and status='pending' and exists(select 1 from public.ads a where a.id=ad_id and a.kind='found' and a.user_id<>auth.uid()));
drop policy if exists "claimants view own claims" on public.objeo_claims;
create policy "claimants view own claims" on public.objeo_claims for select to authenticated using(claimant_id=auth.uid() or exists(select 1 from public.ads a where a.id=ad_id and a.user_id=auth.uid()));
drop policy if exists "owners decide claims" on public.objeo_claims;
create policy "owners decide claims" on public.objeo_claims for update to authenticated using(exists(select 1 from public.ads a where a.id=ad_id and a.user_id=auth.uid())) with check(exists(select 1 from public.ads a where a.id=ad_id and a.user_id=auth.uid()));
create table if not exists public.objeo_match_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references auth.users(id) on delete cascade,
 lost_ad_id uuid not null references public.ads(id) on delete cascade,
 found_ad_id uuid not null references public.ads(id) on delete cascade,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(recipient_id,lost_ad_id,found_ad_id)
);
create index if not exists objeo_match_notifications_recipient on public.objeo_match_notifications(recipient_id,created_at desc);
alter table public.objeo_match_notifications enable row level security;
drop policy if exists "recipient sees match alerts" on public.objeo_match_notifications;
create policy "recipient sees match alerts" on public.objeo_match_notifications for select to authenticated using(recipient_id=auth.uid());
drop policy if exists "recipient marks read" on public.objeo_match_notifications;
create policy "recipient marks read" on public.objeo_match_notifications for update to authenticated using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());
create or replace function public.objeo_notify_potential_matches() returns trigger language plpgsql security definer set search_path=public as $$
declare other_ad record; lost_id uuid; found_id uuid; recipient uuid;
begin
 if new.status is distinct from 'open' or new.kind not in ('lost','found') then return new; end if;
 for other_ad in select id,user_id,title,category,city from public.ads
   where id<>new.id and status='open' and kind=case when new.kind='lost' then 'found' else 'lost' end
     and user_id<>new.user_id
     and (lower(coalesce(category,''))=lower(coalesce(new.category,'')) or
       lower(coalesce(title,'')) like '%'||lower(split_part(new.title,' ',1))||'%')
   order by created_at desc limit 30
 loop
   if new.kind='lost' then lost_id:=new.id;found_id:=other_ad.id;recipient:=new.user_id;
   else lost_id:=other_ad.id;found_id:=new.id;recipient:=other_ad.user_id;end if;
   insert into public.objeo_match_notifications(recipient_id,lost_ad_id,found_ad_id)
   values(recipient,lost_id,found_id) on conflict do nothing;
 end loop;
 return new;
end $$;
drop trigger if exists objeo_match_new_ad on public.ads;
create trigger objeo_match_new_ad after insert on public.ads for each row execute function public.objeo_notify_potential_matches();
-- Alerts are suggestions, not proof of ownership. No private address is exposed.
