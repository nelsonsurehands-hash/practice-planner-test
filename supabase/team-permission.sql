-- The Extra Coach: separate "Calendar & games" from "Team settings, roster & parent sign-ups" (Oct 2026).
-- Coaches already set up keep the same access they have today: team settings follow their calendar setting
-- until you change it. Run once in Supabase -> SQL Editor -> New query -> paste -> Run. Safe to run again.

-- 1) Permission check: 'team' is its own area, and falls back to the old calendar switch.
create or replace function public.can_edit(t uuid, area text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when m.role = 'owner' then true
                else coalesce((m.perms ->> area)::boolean,
                              case when area = 'team' then (m.perms ->> 'schedule')::boolean end,
                              m.role = 'coach' and area <> 'staff') end
      from team_members m where m.team_id = t and m.user_id = auth.uid()), false);
$$;

-- 2) Roster and bus lists belong to team settings now.
create or replace function public.item_area(k text) returns text
language sql immutable as $$
  select case k when 'plays' then 'plays' when 'drills' then 'drills'
                when 'players' then 'team' when 'trips' then 'team' else 'plans' end;
$$;
drop policy if exists "members read items" on public.items;
create policy "members read items" on public.items for select to authenticated
  using (is_member(team_id) and (kind <> 'players' or member_role(team_id) <> 'viewer' or can_edit(team_id, 'team')));

-- 3) Game-day food sign-ups belong to team settings.
drop policy if exists "editors add boards"    on public.signup_boards;
drop policy if exists "editors change boards" on public.signup_boards;
drop policy if exists "editors delete boards" on public.signup_boards;
create policy "editors add boards"    on public.signup_boards for insert to authenticated with check (can_edit(team_id, 'team') and length(id) >= 10);
create policy "editors change boards" on public.signup_boards for update to authenticated using (can_edit(team_id, 'team')) with check (can_edit(team_id, 'team'));
create policy "editors delete boards" on public.signup_boards for delete to authenticated using (can_edit(team_id, 'team'));
drop policy if exists "staff read signups" on public.signup_entries;
drop policy if exists "coaches read signups" on public.signup_entries;
drop policy if exists "editors remove signups" on public.signup_entries;
create policy "staff read signups" on public.signup_entries for select to authenticated
  using (is_member(team_id) and (member_role(team_id) <> 'viewer' or can_edit(team_id, 'team')));
create policy "editors remove signups" on public.signup_entries for delete to authenticated using (can_edit(team_id, 'team'));

-- 4) The team's settings: either permission may save, but each only changes its own part.
drop policy if exists "editors update team" on public.teams;
drop policy if exists "schedule editors update team" on public.teams;
create policy "schedule editors update team" on public.teams for update to authenticated
  using (can_edit(id, 'schedule') or can_edit(id, 'team')) with check (can_edit(id, 'schedule') or can_edit(id, 'team'));

create or replace function public.check_team_settings_parts() returns trigger
language plpgsql set search_path = public as $$
declare cal text[] := array['games','special','practiceDays','weekdayStart','weekdayEnd','weekendStart','weekendEnd',
                           'seasonStart','seasonEnd','minPractices','arriveEarly','practiceNote'];
        o jsonb := coalesce(old.settings, '{}'::jsonb); n jsonb := coalesce(new.settings, '{}'::jsonb);
begin
  if auth.uid() is null then return new; end if;   -- SQL editor / server jobs
  if not can_edit(new.id, 'schedule') and (n - 'library') - (select coalesce(array_agg(k), '{}') from jsonb_object_keys(n) k where k <> all(cal))
     is distinct from (o - 'library') - (select coalesce(array_agg(k), '{}') from jsonb_object_keys(o) k where k <> all(cal)) then
    raise exception 'You can change team settings, but not the calendar or games.';
  end if;
  if not can_edit(new.id, 'team') and ((n - cal) - 'library' is distinct from (o - cal) - 'library' or new.name is distinct from old.name) then
    raise exception 'You can change the calendar and games, but not team settings.';
  end if;
  return new;
end $$;
drop trigger if exists teams_settings_parts on public.teams;
create trigger teams_settings_parts before update on public.teams
  for each row execute function public.check_team_settings_parts();

grant execute on function public.can_edit(uuid, text), public.item_area(text) to authenticated;
select 'Calendar and team settings are now separate permissions' as done;
