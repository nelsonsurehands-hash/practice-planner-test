-- Coach Practice Planner: team tools (added Oct 2026).
--   * Roster: players and parent contacts (kind 'players'), hidden from view-only members.
--   * Bus lists for away games (kind 'trips').
--   * Scouting reports (kind 'scouts') and gameplans (kind 'gameplans'): editable by whoever can edit practice plans.
--   * Game-day food sign-up sheets parents open from a link, with no account.
--   * Add from a photo: a usage count for the monthly cap (table ai_usage).
--   * A parent calendar link: an always-current season calendar parents open with no account.
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
-- Player playbook links leave out plays saved only as drafts. (A saved play with draft
-- changes still shows its last saved version.)
-- ---------------------------------------------------------------------------
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
