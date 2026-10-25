-- Coach Practice Planner: database setup for Supabase.
-- Run this in your project's SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run, and safe to run over the earlier version: it only adds what is missing
-- and replaces the functions and security rules.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
-- A team is one staff's planner for one sport (e.g. "Riverside 8th Grade Girls Basketball").
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  settings    jsonb not null default '{}'::jsonb,   -- sport, school, colors, season, games, special days
  join_code   text not null unique,                 -- coaches join the staff with this
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
alter table public.teams add column if not exists viewer_code text unique;   -- view-only access

create table if not exists public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'coach',
  email      text,
  joined_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);
alter table public.team_members add column if not exists display_name text;
alter table public.team_members add column if not exists title text;          -- "Head Coach", "JV Assistant"…
alter table public.team_members drop constraint if exists team_members_role_check;
alter table public.team_members add constraint team_members_role_check check (role in ('owner','coach','viewer'));
create index if not exists team_members_user_idx on public.team_members(user_id);

-- Drills, practice plans and plays. One row per item; the item itself is JSON.
create table if not exists public.items (
  team_id     uuid not null references public.teams(id) on delete cascade,
  kind        text not null check (kind in ('drills','plans','plays')),
  id          text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null,
  primary key (team_id, kind, id)
);
alter table public.items replica identity full;   -- live updates include deleted rows

-- ---------------------------------------------------------------------------
-- Helper checks (security definer so the rules below don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.member_role(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from team_members where team_id = t and user_id = auth.uid();
$$;
create or replace function public.is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select member_role(t) is not null;
$$;
create or replace function public.is_editor(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(member_role(t) in ('owner','coach'), false);
$$;
create or replace function public.is_owner(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(member_role(t) = 'owner', false);
$$;

create or replace function public.random_join_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O or 1/I mix-ups
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from teams where join_code = code or viewer_code = code);
  end loop;
  return code;
end $$;

-- Name to show for the signed-in coach: what they typed, else their account name, else their email.
create or replace function public.my_default_name(p_name text) returns text
language sql stable set search_path = public as $$
  select coalesce(nullif(trim(p_name), ''),
                  nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
                  split_part(auth.jwt() ->> 'email', '@', 1));
$$;

-- Give older teams a view-only code.
update public.teams set viewer_code = public.random_join_code() where viewer_code is null;

-- ---------------------------------------------------------------------------
-- Actions the app calls
-- ---------------------------------------------------------------------------
drop function if exists public.create_team(text, jsonb);
drop function if exists public.join_team(text);
drop function if exists public.new_join_code(uuid);

-- Create a team; the caller becomes its owner (head coach). Returns the new team id.
create or replace function public.create_team(p_name text, p_settings jsonb default '{}'::jsonb, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into teams (name, settings, join_code, viewer_code, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'My team'), coalesce(p_settings, '{}'::jsonb),
            random_join_code(), random_join_code(), auth.uid())
    returning id into new_id;
  insert into team_members (team_id, user_id, role, email, display_name, title)
    values (new_id, auth.uid(), 'owner', auth.jwt() ->> 'email', my_default_name(p_display_name), 'Head Coach');
  return new_id;
end $$;

-- Join with a staff code (edit access) or a view-only code. Returns the team id.
create or replace function public.join_team(p_code text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid; r text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select id, case when join_code = upper(trim(p_code)) then 'coach' else 'viewer' end into t, r
    from teams where join_code = upper(trim(p_code)) or viewer_code = upper(trim(p_code));
  if t is null then raise exception 'No team found with that code. Check it with your head coach.'; end if;
  insert into team_members (team_id, user_id, role, email, display_name, title)
    values (t, auth.uid(), r, auth.jwt() ->> 'email', my_default_name(p_display_name), case when r = 'coach' then 'Assistant Coach' else null end)
    on conflict (team_id, user_id) do nothing;   -- already on the staff: keep their current role
  return t;
end $$;

-- Owner only: change someone's role and/or title.
create or replace function public.set_member(p_team uuid, p_user uuid, p_role text default null, p_title text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner(p_team) then raise exception 'Only a head coach (owner) can change the staff.'; end if;
  if p_role is not null and p_role not in ('owner','coach','viewer') then raise exception 'Unknown role.'; end if;
  if p_role is not null and p_role <> 'owner'
     and (select role from team_members where team_id = p_team and user_id = p_user) = 'owner'
     and (select count(*) from team_members where team_id = p_team and role = 'owner') = 1 then
    raise exception 'A team needs at least one head coach (owner). Make someone else an owner first.';
  end if;
  update team_members
     set role = coalesce(p_role, role),
         title = case when p_title is null then title else nullif(trim(p_title), '') end
   where team_id = p_team and user_id = p_user;
end $$;

-- Owner removes someone, or anyone leaves a team themselves.
create or replace function public.remove_member(p_team uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (is_owner(p_team) or p_user = auth.uid()) then raise exception 'Only a head coach (owner) can remove someone.'; end if;
  if (select role from team_members where team_id = p_team and user_id = p_user) = 'owner'
     and (select count(*) from team_members where team_id = p_team and role = 'owner') = 1 then
    raise exception 'A team needs at least one head coach (owner). Make someone else an owner first.';
  end if;
  delete from team_members where team_id = p_team and user_id = p_user;
end $$;

-- Change your own name everywhere you coach.
create or replace function public.update_my_name(p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update team_members set display_name = my_default_name(p_name) where user_id = auth.uid();
end $$;

-- Owner only: issue a new staff or view-only code (the old one stops working).
create or replace function public.new_join_code(p_team uuid, p_kind text default 'staff')
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not is_owner(p_team) then raise exception 'Only a head coach (owner) can change join codes.'; end if;
  code := random_join_code();
  if p_kind = 'viewer' then update teams set viewer_code = code where id = p_team;
  else update teams set join_code = code where id = p_team; end if;
  return code;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_team(text, jsonb, text)', 'public.join_team(text, text)',
    'public.set_member(uuid, uuid, text, text)', 'public.remove_member(uuid, uuid)',
    'public.update_my_name(text)', 'public.new_join_code(uuid, text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
--   viewers: read only · coaches: read and edit · owners: also manage the staff
--   nobody sees a team they are not on
-- ---------------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.items enable row level security;

drop policy if exists "members read team" on public.teams;
drop policy if exists "members update team" on public.teams;
drop policy if exists "editors update team" on public.teams;
drop policy if exists "owner deletes team" on public.teams;
create policy "members read team"   on public.teams for select to authenticated using (is_member(id));
create policy "editors update team" on public.teams for update to authenticated using (is_editor(id)) with check (is_editor(id));
create policy "owner deletes team"  on public.teams for delete to authenticated using (is_owner(id));

drop policy if exists "see own and teammates" on public.team_members;
drop policy if exists "leave or remove" on public.team_members;
create policy "see own and teammates" on public.team_members for select to authenticated using (user_id = auth.uid() or is_member(team_id));
-- No insert/update/delete policies: staff changes only happen through the functions above.

drop policy if exists "members read items" on public.items;
drop policy if exists "members write items" on public.items;
drop policy if exists "members update items" on public.items;
drop policy if exists "members delete items" on public.items;
drop policy if exists "editors write items" on public.items;
drop policy if exists "editors update items" on public.items;
drop policy if exists "editors delete items" on public.items;
create policy "members read items"   on public.items for select to authenticated using (is_member(team_id));
create policy "editors write items"  on public.items for insert to authenticated with check (is_editor(team_id));
create policy "editors update items" on public.items for update to authenticated using (is_editor(team_id)) with check (is_editor(team_id));
create policy "editors delete items" on public.items for delete to authenticated using (is_editor(team_id));

-- ---------------------------------------------------------------------------
-- Live updates (a coach's change shows up on the rest of the staff's screens)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items') then
    alter publication supabase_realtime add table public.items;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Player playbooks: share links players can open without an account
-- ---------------------------------------------------------------------------
create table if not exists public.playbooks (
  id          text primary key,                 -- random 10-character id in the share link
  team_id     uuid not null references public.teams(id) on delete cascade,
  title       text not null default 'Playbook',
  play_ids    text[],                           -- null = every play on the team
  active      boolean not null default true,    -- false = link turned off
  views       integer not null default 0,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
alter table public.playbooks enable row level security;
drop policy if exists "members read playbooks" on public.playbooks;
drop policy if exists "editors add playbooks" on public.playbooks;
drop policy if exists "editors change playbooks" on public.playbooks;
drop policy if exists "editors delete playbooks" on public.playbooks;
create policy "members read playbooks"   on public.playbooks for select to authenticated using (is_member(team_id));
create policy "editors add playbooks"    on public.playbooks for insert to authenticated with check (is_editor(team_id) and length(id) >= 10);
create policy "editors change playbooks" on public.playbooks for update to authenticated using (is_editor(team_id)) with check (is_editor(team_id));
create policy "editors delete playbooks" on public.playbooks for delete to authenticated using (is_editor(team_id));

-- What a player's link returns: the team's name and colors, and the chosen plays. Nothing else.
create or replace function public.get_playbook(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pb playbooks; t teams; result jsonb;
begin
  select * into pb from playbooks where id = p_id and active;
  if pb.id is null then return null; end if;
  select * into t from teams where id = pb.team_id;
  update playbooks set views = views + 1 where id = pb.id;
  select jsonb_build_object(
    'v', 1,
    'title', pb.title,
    'team', jsonb_build_object('name', t.name,
                               'sport', coalesce(t.settings->>'sport','basketball'),
                               'color', t.settings->>'color',
                               'color2', t.settings->>'color2',
                               'logo', t.settings->>'logo',
                               'school', t.settings->>'school',
                               'mascot', t.settings->>'mascot',
                               'teamLabel', t.settings->>'teamLabel'),
    'plays', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.data->>'name', 'type', i.data->>'type',
                                          'notes', coalesce(i.data->>'notes',''), 'frames', i.data->'frames')
                       order by i.data->>'type', i.data->>'name')
        from items i
       where i.team_id = pb.team_id and i.kind = 'plays'
         and (pb.play_ids is null or i.id = any(pb.play_ids))
         and coalesce(i.data->>'draft', 'false') <> 'true'), '[]'::jsonb))
  into result;
  return result;
end $$;
revoke all on function public.get_playbook(text) from public;
grant execute on function public.get_playbook(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Explicit access grants. Newer Supabase projects no longer give signed-in users
-- access to new tables and functions automatically; row-level security above still
-- decides which rows each coach can see or change.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.teams, public.team_members, public.items, public.playbooks to authenticated;
grant execute on function public.member_role(uuid), public.is_member(uuid), public.is_editor(uuid), public.is_owner(uuid),
  public.create_team(text, jsonb, text), public.join_team(text, text), public.set_member(uuid, uuid, text, text),
  public.remove_member(uuid, uuid), public.update_my_name(text), public.new_join_code(uuid, text) to authenticated;
grant execute on function public.get_playbook(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Roles and permissions (also in supabase/roles.sql for existing projects)
-- ---------------------------------------------------------------------------
alter table public.team_members add column if not exists perms jsonb;   -- e.g. {"plays":false,"schedule":true}

create or replace function public.can_edit(t uuid, area text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when m.role = 'owner' then true
                else coalesce((m.perms ->> area)::boolean, m.role = 'coach' and area <> 'staff') end
      from team_members m where m.team_id = t and m.user_id = auth.uid()), false);
$$;
create or replace function public.item_area(k text) returns text
language sql immutable as $$
  select case k when 'plays' then 'plays' when 'drills' then 'drills' else 'plans' end;
$$;

-- Change someone's permissions (head coach, or anyone allowed to manage the staff).
create or replace function public.set_member_perms(p_team uuid, p_user uuid, p_perms jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_edit(p_team, 'staff') then raise exception 'You don''t have permission to manage the staff.'; end if;
  if (select role from team_members where team_id = p_team and user_id = p_user) = 'owner' then
    raise exception 'Head coaches always have every permission.'; end if;
  update team_members set perms = p_perms where team_id = p_team and user_id = p_user;
end $$;

-- Role and title: staff managers can change them; only a head coach can make or unmake a head coach.
create or replace function public.set_member(p_team uuid, p_user uuid, p_role text default null, p_title text default null)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if not can_edit(p_team, 'staff') then raise exception 'You don''t have permission to manage the staff.'; end if;
  if p_role is not null and p_role not in ('owner','coach','viewer') then raise exception 'Unknown role.'; end if;
  select role into cur from team_members where team_id = p_team and user_id = p_user;
  if not is_owner(p_team) and (p_role = 'owner' or cur = 'owner') then
    raise exception 'Only a head coach can make or change a head coach.'; end if;
  if p_role is not null and p_role <> 'owner' and cur = 'owner'
     and (select count(*) from team_members where team_id = p_team and role = 'owner') = 1 then
    raise exception 'A team needs at least one head coach (owner). Make someone else an owner first.';
  end if;
  update team_members
     set role = coalesce(p_role, role),
         perms = case when p_role is not null and p_role <> role then null else perms end,   -- new role starts from its defaults
         title = case when p_title is null then title else nullif(trim(p_title), '') end
   where team_id = p_team and user_id = p_user;
end $$;

create or replace function public.remove_member(p_team uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  select role into cur from team_members where team_id = p_team and user_id = p_user;
  if not (p_user = auth.uid() or is_owner(p_team) or (can_edit(p_team, 'staff') and cur <> 'owner')) then
    raise exception 'You don''t have permission to remove this person.'; end if;
  if cur = 'owner' and (select count(*) from team_members where team_id = p_team and role = 'owner') = 1 then
    raise exception 'A team needs at least one head coach (owner). Make someone else an owner first.';
  end if;
  delete from team_members where team_id = p_team and user_id = p_user;
end $$;

create or replace function public.new_join_code(p_team uuid, p_kind text default 'staff')
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not can_edit(p_team, 'staff') then raise exception 'You don''t have permission to change join codes.'; end if;
  code := random_join_code();
  if p_kind = 'viewer' then update teams set viewer_code = code where id = p_team;
  else update teams set join_code = code where id = p_team; end if;
  return code;
end $$;

-- What each area lets someone change
drop policy if exists "editors update team" on public.teams;
drop policy if exists "schedule editors update team" on public.teams;
create policy "schedule editors update team" on public.teams for update to authenticated
  using (can_edit(id, 'schedule')) with check (can_edit(id, 'schedule'));

drop policy if exists "editors write items" on public.items;
drop policy if exists "editors update items" on public.items;
drop policy if exists "editors delete items" on public.items;
create policy "editors write items"  on public.items for insert to authenticated with check (can_edit(team_id, item_area(kind)));
create policy "editors update items" on public.items for update to authenticated using (can_edit(team_id, item_area(kind))) with check (can_edit(team_id, item_area(kind)));
create policy "editors delete items" on public.items for delete to authenticated using (can_edit(team_id, item_area(kind)));

drop policy if exists "editors add playbooks" on public.playbooks;
drop policy if exists "editors change playbooks" on public.playbooks;
drop policy if exists "editors delete playbooks" on public.playbooks;
create policy "editors add playbooks"    on public.playbooks for insert to authenticated with check (can_edit(team_id, 'share') and length(id) >= 10);
create policy "editors change playbooks" on public.playbooks for update to authenticated using (can_edit(team_id, 'share')) with check (can_edit(team_id, 'share'));
create policy "editors delete playbooks" on public.playbooks for delete to authenticated using (can_edit(team_id, 'share'));

grant execute on function public.can_edit(uuid, text), public.item_area(text), public.set_member_perms(uuid, uuid, jsonb),
  public.set_member(uuid, uuid, text, text), public.remove_member(uuid, uuid), public.new_join_code(uuid, text) to authenticated;
revoke all on function public.set_member_perms(uuid, uuid, jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- Team tools: roster, bus lists, game-day food sign-ups (same as team-tools.sql)
-- ---------------------------------------------------------------------------
-- Coach Practice Planner: team tools (added Oct 2026).
--   * Roster: players and parent contacts (kind 'players'), hidden from view-only members.
--   * Bus lists for away games (kind 'trips').
--   * Game-day food sign-up sheets parents open from a link, with no account.
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
-- It includes the roles and permissions setup, so it works whether or not roles.sql was run.

alter table public.team_members add column if not exists perms jsonb;

-- Allow the new kinds of saved items: players (roster), trips (bus lists),
-- scouts (scouting reports, one per opponent), gameplans (one per game) and gamestats (live stats per game).
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check check (kind in ('drills','plans','plays','players','trips','scouts','gameplans','gamestats'));

create or replace function public.can_edit(t uuid, area text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when m.role = 'owner' then true
                else coalesce((m.perms ->> area)::boolean, m.role = 'coach' and area <> 'staff') end
      from team_members m where m.team_id = t and m.user_id = auth.uid()), false);
$$;

-- Which permission area each kind of saved item belongs to.
create or replace function public.item_area(k text) returns text
language sql immutable as $$
  select case k when 'plays' then 'plays' when 'drills' then 'drills'
                when 'players' then 'schedule' when 'trips' then 'schedule' else 'plans' end;
$$;

-- Read access: everyone on the team, except that parent phone numbers and emails in the roster
-- are only visible to coaches and to people allowed to edit the calendar and team.
drop policy if exists "members read items" on public.items;
create policy "members read items" on public.items for select to authenticated
  using (is_member(team_id) and (kind <> 'players' or member_role(team_id) <> 'viewer' or can_edit(team_id, 'schedule')));

drop policy if exists "editors write items" on public.items;
drop policy if exists "editors update items" on public.items;
drop policy if exists "editors delete items" on public.items;
create policy "editors write items"  on public.items for insert to authenticated with check (can_edit(team_id, item_area(kind)));
create policy "editors update items" on public.items for update to authenticated using (can_edit(team_id, item_area(kind))) with check (can_edit(team_id, item_area(kind)));
create policy "editors delete items" on public.items for delete to authenticated using (can_edit(team_id, item_area(kind)));

drop policy if exists "editors update team" on public.teams;
drop policy if exists "schedule editors update team" on public.teams;
create policy "schedule editors update team" on public.teams for update to authenticated
  using (can_edit(id, 'schedule')) with check (can_edit(id, 'schedule'));

-- ---------------------------------------------------------------------------
-- Game-day food sign-ups
-- ---------------------------------------------------------------------------
create table if not exists public.signup_boards (
  id          text primary key,                    -- random id in the parents' link
  team_id     uuid not null references public.teams(id) on delete cascade,
  title       text not null default 'Game-day food',
  note        text not null default '',
  games       text not null default 'all' check (games in ('all','home','away')),
  slots       jsonb not null default '[{"name":"Snacks","count":2},{"name":"Drinks","count":1}]'::jsonb,
  skip        text[] not null default '{}',        -- game dates with no sign-ups
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create table if not exists public.signup_entries (
  id          uuid primary key default gen_random_uuid(),
  board_id    text not null references public.signup_boards(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  game_date   date not null,
  slot        text not null,
  name        text not null,
  contact     text not null default '',
  player      text not null default '',
  item        text not null default '',
  token       uuid not null default gen_random_uuid(),   -- lets the parent cancel from their phone
  created_at  timestamptz not null default now()
);
create index if not exists signup_entries_board on public.signup_entries(board_id, game_date);
-- When food needs to be delivered: home games share one time; each game can have its own (away games).
alter table public.signup_boards add column if not exists dropoff jsonb not null default '{"home":"16:00","games":{}}'::jsonb;

alter table public.signup_boards enable row level security;
alter table public.signup_entries enable row level security;
drop policy if exists "members read boards" on public.signup_boards;
drop policy if exists "editors add boards" on public.signup_boards;
drop policy if exists "editors change boards" on public.signup_boards;
drop policy if exists "editors delete boards" on public.signup_boards;
create policy "members read boards"   on public.signup_boards for select to authenticated using (is_member(team_id));
create policy "editors add boards"    on public.signup_boards for insert to authenticated with check (can_edit(team_id, 'schedule') and length(id) >= 10);
create policy "editors change boards" on public.signup_boards for update to authenticated using (can_edit(team_id, 'schedule')) with check (can_edit(team_id, 'schedule'));
create policy "editors delete boards" on public.signup_boards for delete to authenticated using (can_edit(team_id, 'schedule'));
drop policy if exists "staff read signups" on public.signup_entries;
drop policy if exists "editors remove signups" on public.signup_entries;
create policy "staff read signups"     on public.signup_entries for select to authenticated
  using (is_member(team_id) and (member_role(team_id) <> 'viewer' or can_edit(team_id, 'schedule')));
create policy "editors remove signups" on public.signup_entries for delete to authenticated using (can_edit(team_id, 'schedule'));
-- Parents add and cancel only through the functions below.

-- What the parents' page shows: team name and colors, the upcoming games, the open spots,
-- and who has signed up (first name and last initial, and what they're bringing). No contact info.
create or replace function public.get_signup(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b signup_boards; t teams;
begin
  select * into b from signup_boards where id = p_id and active;
  if b.id is null then return null; end if;
  select * into t from teams where id = b.team_id;
  return jsonb_build_object(
    'title', b.title, 'note', b.note, 'slots', b.slots, 'dropoff', b.dropoff,
    'team', jsonb_build_object('name', t.name, 'color', t.settings->>'color', 'color2', t.settings->>'color2',
                               'logo', t.settings->>'logo', 'school', t.settings->>'school',
                               'mascot', t.settings->>'mascot', 'teamLabel', t.settings->>'teamLabel'),
    'games', coalesce((
      -- every game of the season (home/away as the coach chose); past and "no food needed" games are flagged
      select jsonb_agg(jsonb_build_object('date', g->>'date', 'opponent', g->>'opponent', 'time', g->>'time',
                                          'home', coalesce((g->>'home')::boolean, true),
                                          'past', (g->>'date') < to_char(current_date - 1, 'YYYY-MM-DD'),
                                          'skip', (g->>'date') = any(b.skip))
                       order by g->>'date')
        from jsonb_array_elements(coalesce(t.settings->'games', '[]'::jsonb)) g
       where coalesce(g->>'date', '') <> ''
         and (b.games = 'all' or (b.games = 'home') = coalesce((g->>'home')::boolean, true))), '[]'::jsonb),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'date', to_char(e.game_date, 'YYYY-MM-DD'), 'slot', e.slot,
                                          'name', regexp_replace(trim(e.name), '^(\S+).*\s(\S)\S*$', '\1 \2.'),
                                          'item', e.item) order by e.created_at)
        from signup_entries e where e.board_id = b.id and e.game_date >= current_date - 1), '[]'::jsonb));
end $$;

create or replace function public.add_signup(p_id text, p_date text, p_slot text, p_name text,
                                             p_contact text default '', p_player text default '', p_item text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare b signup_boards; t teams; cap int; taken int; e signup_entries; nm text := trim(coalesce(p_name, ''));
begin
  select * into b from signup_boards where id = p_id and active for update;   -- one sign-up at a time per sheet
  if b.id is null then raise exception 'This sign-up sheet is closed.'; end if;
  if length(nm) < 2 then raise exception 'Please enter your name.'; end if;
  if length(trim(coalesce(p_contact, ''))) < 5 then raise exception 'Please enter a phone number or email so the coach can reach you.'; end if;
  select * into t from teams where id = b.team_id;
  if not exists (select 1 from jsonb_array_elements(coalesce(t.settings->'games', '[]'::jsonb)) g
                  where g->>'date' = p_date and p_date >= to_char(current_date - 1, 'YYYY-MM-DD')
                    and not (p_date = any(b.skip))
                    and (b.games = 'all' or (b.games = 'home') = coalesce((g->>'home')::boolean, true))) then
    raise exception 'That game is no longer on the sign-up sheet.'; end if;
  select (s->>'count')::int into cap from jsonb_array_elements(b.slots) s where s->>'name' = p_slot limit 1;
  if cap is null then raise exception 'That item is no longer on the sign-up sheet.'; end if;
  select count(*) into taken from signup_entries where board_id = b.id and game_date = p_date::date and slot = p_slot;
  if taken >= cap then raise exception 'Someone just took the last spot for that. Pick another one.'; end if;
  insert into signup_entries (board_id, team_id, game_date, slot, name, contact, player, item)
  values (b.id, b.team_id, p_date::date, p_slot, left(nm, 60), left(trim(coalesce(p_contact, '')), 80),
          left(trim(coalesce(p_player, '')), 60), left(trim(coalesce(p_item, '')), 120))
  returning * into e;
  return jsonb_build_object('id', e.id, 'token', e.token);
end $$;

create or replace function public.cancel_signup(p_entry uuid, p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from signup_entries where id = p_entry and token = p_token;
  return found;
end $$;

revoke all on function public.get_signup(text), public.add_signup(text, text, text, text, text, text, text),
  public.cancel_signup(uuid, uuid) from public;
grant execute on function public.get_signup(text), public.add_signup(text, text, text, text, text, text, text),
  public.cancel_signup(uuid, uuid) to anon, authenticated;
grant select, insert, update, delete on public.signup_boards to authenticated;
grant select, delete on public.signup_entries to authenticated;
grant execute on function public.can_edit(uuid, text), public.item_area(text) to authenticated;

-- Live updates for new sign-ups on the coach's screen
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'signup_entries') then
    alter publication supabase_realtime add table public.signup_entries;
  end if;
exception when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Add from a photo (roster, schedule, plays): one row per photo read, for the monthly cap.
-- Written only by the photo-import server function; coaches can see their team's count.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  id         bigserial primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  kind       text not null,
  photos     integer not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_team_month on public.ai_usage(team_id, created_at);
alter table public.ai_usage enable row level security;
drop policy if exists "members read ai usage" on public.ai_usage;
create policy "members read ai usage" on public.ai_usage for select to authenticated using (is_member(team_id));
grant select on public.ai_usage to authenticated;

-- ---------------------------------------------------------------------------
-- Parent calendar link: a read-only, always-current season calendar parents open
-- from a link (schedule.html?c=…), with no account. It can also feed their phone's
-- calendar app through the calendar-feed function.
-- ---------------------------------------------------------------------------
create table if not exists public.calendar_shares (
  id          text primary key,                    -- random id in the parents' link
  team_id     uuid not null unique references public.teams(id) on delete cascade,
  title       text not null default '',
  show        jsonb not null default '{"practices":true,"games":true,"off":true}'::jsonb,
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
alter table public.calendar_shares enable row level security;
drop policy if exists "members read calendar links" on public.calendar_shares;
drop policy if exists "editors add calendar links" on public.calendar_shares;
drop policy if exists "editors change calendar links" on public.calendar_shares;
drop policy if exists "editors delete calendar links" on public.calendar_shares;
create policy "members read calendar links"   on public.calendar_shares for select to authenticated using (is_member(team_id));
create policy "editors add calendar links"    on public.calendar_shares for insert to authenticated with check (can_edit(team_id, 'schedule') and length(id) >= 10);
create policy "editors change calendar links" on public.calendar_shares for update to authenticated using (can_edit(team_id, 'schedule')) with check (can_edit(team_id, 'schedule'));
create policy "editors delete calendar links" on public.calendar_shares for delete to authenticated using (can_edit(team_id, 'schedule'));

-- What the parents' calendar shows: team name, colors and logo, and the schedule parts of the
-- team settings (season dates, practice days and times, games, special days). Nothing else.
create or replace function public.get_calendar(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c calendar_shares; t teams; s jsonb;
begin
  select * into c from calendar_shares where id = p_id and active;
  if c.id is null then return null; end if;
  select * into t from teams where id = c.team_id;
  s := coalesce(t.settings, '{}'::jsonb);
  return jsonb_build_object(
    'title', c.title, 'show', c.show,
    'team', jsonb_build_object('name', t.name, 'color', s->>'color', 'color2', s->>'color2', 'logo', s->>'logo',
                               'school', s->>'school', 'mascot', s->>'mascot', 'teamLabel', s->>'teamLabel', 'sport', s->>'sport'),
    'schedule', jsonb_build_object(
      'seasonStart', s->>'seasonStart', 'seasonEnd', s->>'seasonEnd', 'practiceDays', coalesce(s->'practiceDays', '[]'::jsonb),
      'weekdayStart', s->>'weekdayStart', 'weekdayEnd', s->>'weekdayEnd', 'weekendStart', s->>'weekendStart', 'weekendEnd', s->>'weekendEnd',
      'games', coalesce((select jsonb_agg(jsonb_build_object('date', g->>'date', 'opponent', g->>'opponent', 'time', g->>'time',
                                                            'home', coalesce((g->>'home')::boolean, true), 'location', g->>'location'))
                           from jsonb_array_elements(coalesce(s->'games', '[]'::jsonb)) g where coalesce(g->>'date', '') <> ''), '[]'::jsonb),
      'special', coalesce((select jsonb_agg(jsonb_build_object('date', x->>'date', 'kind', x->>'kind', 'note', x->>'note',
                                                              'start', x->>'start', 'end', x->>'end'))
                             from jsonb_array_elements(coalesce(s->'special', '[]'::jsonb)) x where coalesce(x->>'date', '') <> ''), '[]'::jsonb)));
end $$;
revoke all on function public.get_calendar(text) from public;
grant execute on function public.get_calendar(text) to anon, authenticated;
