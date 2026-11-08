-- The Extra Coach: let a head coach change each coach's access after they join.
-- Run once in Supabase -> SQL Editor -> New query -> paste -> Run. Safe to run again.
alter table public.team_members add column if not exists perms jsonb;

create or replace function public.set_member_perms(p_team uuid, p_user uuid, p_perms jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not can_edit(p_team, 'staff') then raise exception 'You don''t have permission to manage the staff.'; end if;
  if (select role from team_members where team_id = p_team and user_id = p_user) = 'owner' then
    raise exception 'Head coaches always have every permission.'; end if;
  if (p_perms ->> 'staff')::boolean and not is_owner(p_team) then
    raise exception 'Only a head coach can let someone manage the staff.'; end if;
  update team_members set perms = p_perms where team_id = p_team and user_id = p_user;
end $$;

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
         perms = case when p_role is not null and p_role <> role then null else perms end,
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

revoke all on function public.set_member_perms(uuid, uuid, jsonb), public.set_member(uuid, uuid, text, text), public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.set_member_perms(uuid, uuid, jsonb), public.set_member(uuid, uuid, text, text), public.remove_member(uuid, uuid) to authenticated;
select 'Coach access can be changed' as done;
