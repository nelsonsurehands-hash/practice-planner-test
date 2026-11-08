-- The Extra Coach: one drill library, playbook and practice plans across teams (Oct 2026).
-- A team can use another team's drills, plays and/or practice plans instead of its own
-- (Team tab -> Teams -> "Drills, plays & plans"). Edits show up on every team that shares them.
-- Only someone who manages the staff of both teams can turn sharing on.
-- Run once in Supabase -> SQL Editor -> New query -> paste -> Run. Safe to run again.

-- Is this team's library (drills / plays / plans) used by a team this person is on?
create or replace function public.lib_can_read(src uuid, k text) returns boolean
language sql stable security definer set search_path = public as $$
  select k in ('drills','plays','plans') and exists (
    select 1 from teams t where t.settings -> 'library' ->> k = src::text and is_member(t.id));
$$;
create or replace function public.lib_can_edit(src uuid, k text) returns boolean
language sql stable security definer set search_path = public as $$
  select k in ('drills','plays','plans') and exists (
    select 1 from teams t where t.settings -> 'library' ->> k = src::text and can_edit(t.id, item_area(k)));
$$;

drop policy if exists "shared library read"   on public.items;
drop policy if exists "shared library insert" on public.items;
drop policy if exists "shared library update" on public.items;
drop policy if exists "shared library delete" on public.items;
create policy "shared library read"   on public.items for select to authenticated using (lib_can_read(team_id, kind));
create policy "shared library insert" on public.items for insert to authenticated with check (lib_can_edit(team_id, kind));
create policy "shared library update" on public.items for update to authenticated using (lib_can_edit(team_id, kind)) with check (lib_can_edit(team_id, kind));
create policy "shared library delete" on public.items for delete to authenticated using (lib_can_edit(team_id, kind));

-- Guard: you can only point a team at a library you manage, and libraries don't chain.
create or replace function public.check_team_library() returns trigger
language plpgsql set search_path = public as $$
declare k text; v text; src uuid;
begin
  if tg_op = 'UPDATE' and (new.settings -> 'library') is not distinct from (old.settings -> 'library') then return new; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(new.settings -> 'library', '{}'::jsonb)) loop
    if k not in ('drills','plays','plans') then raise exception 'Unknown library kind %.', k; end if;
    if v is null or v = '' then continue; end if;
    src := v::uuid;
    if src = new.id then raise exception 'A team can''t share its own library with itself.'; end if;
    if tg_op = 'UPDATE' and old.settings -> 'library' ->> k = v then continue; end if;   -- unchanged
    if auth.uid() is not null and not (can_edit(src, 'staff') and can_edit(new.id, 'staff')) then
      raise exception 'Only a coach who manages the staff of both teams can share a library.';
    end if;
    if exists (select 1 from teams where id = src and coalesce(settings -> 'library' ->> k, '') <> '') then
      raise exception 'That team already uses another team''s library. Pick the team the library comes from.';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists teams_library on public.teams;
create trigger teams_library before insert or update of settings on public.teams
  for each row execute function public.check_team_library();

grant execute on function public.lib_can_read(uuid, text), public.lib_can_edit(uuid, text) to authenticated;

select 'Shared libraries are on' as done;
