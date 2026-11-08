-- My events: a coach's own dates (Varsity games, school events…), grouped under a name.
-- Not tied to any team. Only the coach who added them can see or change them.
create table if not exists public.coach_events (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  title       text not null default 'Event' check (length(title) <= 200),
  time        text check (time is null or time ~ '^\d{2}:\d{2}$'),
  info        text check (info is null or length(info) <= 500),
  list        text not null default 'My events' check (length(list) <= 60),
  created_at  timestamptz not null default now()
);
create index if not exists coach_events_owner_date on public.coach_events (owner, date);
alter table public.coach_events enable row level security;
drop policy if exists "own events read"   on public.coach_events;
drop policy if exists "own events add"    on public.coach_events;
drop policy if exists "own events change" on public.coach_events;
drop policy if exists "own events delete" on public.coach_events;
create policy "own events read"   on public.coach_events for select to authenticated using (owner = auth.uid());
create policy "own events add"    on public.coach_events for insert to authenticated with check (owner = auth.uid());
create policy "own events change" on public.coach_events for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own events delete" on public.coach_events for delete to authenticated using (owner = auth.uid());
grant select, insert, update, delete on public.coach_events to authenticated;
