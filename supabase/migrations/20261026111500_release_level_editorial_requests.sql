begin;

alter table public.track_review_requests
  add column if not exists release_id uuid references public.releases(id) on delete cascade;

alter table public.track_review_requests
  alter column track_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'track_review_requests_exactly_one_target'
      and conrelid = 'public.track_review_requests'::regclass
  ) then
    alter table public.track_review_requests
      add constraint track_review_requests_exactly_one_target
      check ((track_id is null) <> (release_id is null));
  end if;
end
$$;

create index if not exists track_review_requests_release_created_idx
  on public.track_review_requests(release_id, created_at desc)
  where release_id is not null;

alter table public.track_review_requests enable row level security;

revoke all on table public.track_review_requests from anon, authenticated;
grant select, insert on table public.track_review_requests to authenticated;
grant select, insert, update, delete on table public.track_review_requests to service_role;

drop policy if exists "artists manage own track requests" on public.track_review_requests;
drop policy if exists "artists read own editorial requests" on public.track_review_requests;
drop policy if exists "artists create own editorial requests" on public.track_review_requests;

create policy "artists read own editorial requests"
  on public.track_review_requests
  for select
  to authenticated
  using ((select auth.uid()) = artist_user_id);

create policy "artists create own editorial requests"
  on public.track_review_requests
  for insert
  to authenticated
  with check ((select auth.uid()) = artist_user_id);

commit;
