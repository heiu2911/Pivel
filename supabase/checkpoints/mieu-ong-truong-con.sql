-- TravelQuest checkpoint: Miếu ông Trường (con)
-- Run this once in the Supabase SQL Editor for the TravelQuest project.

insert into public.checkpoints (
  name,
  description,
  icon,
  badge,
  longitude,
  latitude
)
select
  'Miếu ông Trường (con)',
  'Checkpoint địa phương tại Miếu ông Trường (con).',
  '🛕',
  'Miếu ông Trường (con)',
  106.6144636,
  20.7805244
where not exists (
  select 1
  from public.checkpoints
  where name = 'Miếu ông Trường (con)'
);
