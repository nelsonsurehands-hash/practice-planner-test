-- Coach Practice Planner: staff roles and permissions (added Oct 2026).
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
-- Each staff member can be allowed to edit any of these areas:
--   plans    practice plans            plays   plays and play options
--   drills   the drill library         schedule calendar, games and team settings
--   share    player playbook links     staff   invite, remove and set permissions for staff
-- Head coaches (owners) can always do everything. Coaches can do everything except manage the
-- staff unless a head coach changes that; view-only members can edit nothing unless allowed.

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
