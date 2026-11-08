-- Hickory Hills girls: 7th grade uses 8th grade's drills, plays and practice plans (one library).
-- First anything only on 7th grade is copied into 8th grade, so nothing is lost:
-- drills and plays 8th doesn't have (by name), and practice plans on dates 8th has no plan.
-- 7th grade's own copies stay saved in the database, just unused. Run AFTER shared-library.sql.

with src as (select '71826d3d-42ea-45fd-b86f-8b92a17ece5e'::uuid s, '5218ebc4-64d4-4e7a-94f7-7cd14d6276ad'::uuid d),
moved as (
  insert into public.items (team_id, kind, id, data, updated_at)
  select src.d, i.kind, i.id, i.data, now()
    from public.items i, src
   where i.team_id = src.s and i.kind in ('drills','plays','plans')
     and not exists (select 1 from public.items x where x.team_id = src.d and x.kind = i.kind
                       and (x.id = i.id or (i.kind <> 'plans' and lower(trim(x.data ->> 'name')) = lower(trim(i.data ->> 'name')))))
  on conflict (team_id, kind, id) do nothing
  returning kind, coalesce(data ->> 'name', data ->> 'date', id) as name
)
select kind as copied_to_8th_grade, name from moved order by kind, name;

update public.teams
   set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{library}',
       '{"drills":"5218ebc4-64d4-4e7a-94f7-7cd14d6276ad","plays":"5218ebc4-64d4-4e7a-94f7-7cd14d6276ad","plans":"5218ebc4-64d4-4e7a-94f7-7cd14d6276ad"}'::jsonb)
 where id = '71826d3d-42ea-45fd-b86f-8b92a17ece5e'
returning settings ->> 'teamLabel' as team, 'now uses 8th grade drills, plays and plans' as done;
