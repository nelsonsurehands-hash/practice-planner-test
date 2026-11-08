-- The Extra Coach: food sign-ups show away-game food times 45 minutes (or your choice) before the bus.
-- Run once in Supabase -> SQL Editor -> New query -> paste -> Run. Safe to run again.

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
                                          'skip', (g->>'date') = any(b.skip),
                                          'bus', (select x->>'bus' from jsonb_array_elements(coalesce(t.settings->'special', '[]'::jsonb)) x
                                                   where x->>'date' = g->>'date' and x ? 'bus' limit 1),
                                          -- other teams from the same school and staff riding the same bus to this game
                                          'with', (select jsonb_agg(jsonb_build_object('team', coalesce(o.settings->>'teamLabel', o.name),
                                                     'signups', coalesce((select jsonb_agg(jsonb_build_object('slot', e.slot,
                                                         'name', regexp_replace(trim(e.name), '^(\S+).*\s(\S)\S*$', '\1 \2.')) order by e.created_at)
                                                       from signup_boards ob join signup_entries e on e.board_id = ob.id
                                                      where ob.team_id = o.id and ob.active and e.game_date = (g->>'date')::date), '[]'::jsonb)))
                                     from teams o
                                    where o.id <> t.id
                                      and coalesce((g->>'home')::boolean, true) = false
                                      and lower(coalesce(o.settings->>'school', '')) = lower(coalesce(t.settings->>'school', '')) and coalesce(t.settings->>'school', '') <> ''
                                      and exists (select 1 from team_members m1 join team_members m2 on m2.user_id = m1.user_id
                                                   where m1.team_id = t.id and m2.team_id = o.id)
                                      and exists (select 1 from jsonb_array_elements(coalesce(o.settings->'games', '[]'::jsonb)) og
                                                   where og->>'date' = g->>'date' and coalesce((og->>'home')::boolean, true) = false)
                                      and (select x->>'bus' from jsonb_array_elements(coalesce(t.settings->'special', '[]'::jsonb)) x
                                            where x->>'date' = g->>'date' and x ? 'bus' limit 1) is not null
                                      and (select x->>'bus' from jsonb_array_elements(coalesce(o.settings->'special', '[]'::jsonb)) x
                                            where x->>'date' = g->>'date' and x ? 'bus' limit 1)
                                        = (select x->>'bus' from jsonb_array_elements(coalesce(t.settings->'special', '[]'::jsonb)) x
                                            where x->>'date' = g->>'date' and x ? 'bus' limit 1)))
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

select 'Food times now follow the bus' as done;
