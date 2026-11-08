-- The Extra Coach: staff invite links (Oct 2026).
-- A head coach (or anyone who manages the staff) makes a link like theextracoach.com/?join=k3x9...
-- with the access already set: assistant coach, team manager, view only, or a custom mix.
-- The coach taps it, signs in or makes an account, and lands on the staff with exactly that access.
-- Links can cover several teams (7th and 8th), can be one-person-only, expire, and can be turned off.
-- Run once in Supabase -> SQL Editor -> New query -> paste -> Run. Safe to run again.

alter table public.team_members add column if not exists perms jsonb;

create table if not exists public.staff_invites (
  id          text primary key,
  team_ids    uuid[] not null,
  role        text not null default 'coach' check (role in ('owner','coach','viewer')),
  perms       jsonb,
  title       text,
  created_by  uuid references auth.users(id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days',
  max_uses    int,                       -- null: anyone with the link; 1: one person only
  uses        int not null default 0,
  active      boolean not null default true
);
alter table public.staff_invites enable row level security;   -- read and written only through the functions below

-- Make a link. You must manage the staff of every team on it; only a head coach can invite a head coach.
create or replace function public.create_staff_invite(p_team_ids uuid[], p_role text default 'coach', p_perms jsonb default null,
  p_title text default null, p_days int default 30, p_max_uses int default null)
returns text language plpgsql security definer set search_path = public as $$
declare t uuid; c text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if coalesce(array_length(p_team_ids, 1), 0) < 1 then raise exception 'Pick at least one team.'; end if;
  if p_role not in ('owner','coach','viewer') then raise exception 'Unknown role.'; end if;
  foreach t in array p_team_ids loop
    if not can_edit(t, 'staff') then raise exception 'You can only invite coaches to teams where you manage the staff.'; end if;
    if p_role = 'owner' and not is_owner(t) then raise exception 'Only a head coach can invite another head coach.'; end if;
  end loop;
  loop
    c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    exit when not exists (select 1 from staff_invites where id = c);
  end loop;
  insert into staff_invites (id, team_ids, role, perms, title, expires_at, max_uses)
  values (c, p_team_ids, p_role, case when p_role = 'owner' then null else p_perms end, nullif(trim(coalesce(p_title, '')), ''),
          now() + make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))), p_max_uses);
  return c;
end $$;

-- Open links that include this team (for the Staff panel).
create or replace function public.list_staff_invites(p_team uuid)
returns table (id text, team_ids uuid[], role text, perms jsonb, title text, created_at timestamptz, expires_at timestamptz, max_uses int, uses int)
language sql stable security definer set search_path = public as $$
  select i.id, i.team_ids, i.role, i.perms, i.title, i.created_at, i.expires_at, i.max_uses, i.uses
    from staff_invites i
   where can_edit(p_team, 'staff') and p_team = any(i.team_ids) and i.active and i.expires_at > now()
     and (i.max_uses is null or i.uses < i.max_uses)
   order by i.created_at desc;
$$;

-- Turn a link off.
create or replace function public.end_staff_invite(p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare i staff_invites; t uuid; ok boolean := false;
begin
  select * into i from staff_invites where id = p_id;
  if i.id is null then return; end if;
  ok := i.created_by = auth.uid();
  if not ok then foreach t in array i.team_ids loop if can_edit(t, 'staff') then ok := true; end if; end loop; end if;
  if not ok then raise exception 'You don''t have permission to turn off this link.'; end if;
  update staff_invites set active = false where id = p_id;
end $$;

-- What the link is for, shown before signing in (team names, colors, logo and the access it gives).
create or replace function public.staff_invite_info(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when i.id is null then jsonb_build_object('ok', false, 'reason', 'missing')
    when not i.active or i.expires_at <= now() or (i.max_uses is not null and i.uses >= i.max_uses) then jsonb_build_object('ok', false, 'reason', 'used')
    else jsonb_build_object('ok', true, 'role', i.role, 'perms', i.perms, 'title', i.title,
      'teams', (select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'teamLabel', t.settings->>'teamLabel', 'school', t.settings->>'school',
                  'mascot', t.settings->>'mascot', 'color', t.settings->>'color', 'logo', t.settings->>'logo') order by t.settings->>'teamLabel'), '[]'::jsonb)
                  from teams t where t.id = any(i.team_ids)))
  end
  from (select 1) one left join staff_invites i on i.id = p_id;
$$;

-- Use a link: joins every team on it with the access the inviter chose. Returns the first team's id.
-- Someone already on a team keeps the access they have there.
create or replace function public.accept_staff_invite(p_id text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare i staff_invites; t uuid; first uuid; added int := 0; n int; nm text;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into i from staff_invites where id = p_id for update;
  if i.id is null then raise exception 'This invite link is wrong. Ask your head coach for a new one.'; end if;
  if not i.active or i.expires_at <= now() then raise exception 'This invite link has expired or was turned off. Ask your head coach for a new one.'; end if;
  nm := coalesce(nullif(trim(coalesce(p_display_name, '')), ''), auth.jwt() -> 'user_metadata' ->> 'full_name', split_part(auth.jwt() ->> 'email', '@', 1));
  foreach t in array i.team_ids loop
    if exists (select 1 from teams where id = t) then
      first := coalesce(first, t);
      if exists (select 1 from team_members where team_id = t and user_id = auth.uid()) then continue; end if;
      if i.max_uses is not null and i.uses >= i.max_uses then raise exception 'This invite link was already used. Ask your head coach for a new one.'; end if;
      insert into team_members (team_id, user_id, role, email, display_name, title, perms)
        values (t, auth.uid(), i.role, auth.jwt() ->> 'email', nm, i.title, i.perms);
      added := added + 1;
    end if;
  end loop;
  if first is null then raise exception 'The team on this link no longer exists.'; end if;
  if added > 0 then update staff_invites set uses = uses + 1 where id = p_id; end if;
  return first;
end $$;

revoke all on function public.create_staff_invite(uuid[], text, jsonb, text, int, int), public.list_staff_invites(uuid),
  public.end_staff_invite(text), public.accept_staff_invite(text, text) from public, anon;
grant execute on function public.create_staff_invite(uuid[], text, jsonb, text, int, int), public.list_staff_invites(uuid),
  public.end_staff_invite(text), public.accept_staff_invite(text, text) to authenticated;
grant execute on function public.staff_invite_info(text) to anon, authenticated;

select 'Staff invite links are on' as done;
