-- TravelQuest: shared location for mutual friends
-- Run this once in Supabase SQL Editor.

create table if not exists public.travelquest_friend_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  sharing_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint travelquest_friend_locations_latitude_check
    check (latitude between -90 and 90),
  constraint travelquest_friend_locations_longitude_check
    check (longitude between -180 and 180)
);

create index if not exists travelquest_friend_locations_updated_at_idx
  on public.travelquest_friend_locations(updated_at desc);

alter table public.travelquest_friend_locations enable row level security;

drop policy if exists "Users can insert their own location" on public.travelquest_friend_locations;
create policy "Users can insert their own location"
on public.travelquest_friend_locations
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own location" on public.travelquest_friend_locations;
create policy "Users can update their own location"
on public.travelquest_friend_locations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read mutual friends shared locations" on public.travelquest_friend_locations;
create policy "Users can read mutual friends shared locations"
on public.travelquest_friend_locations
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    sharing_enabled = true
    and exists (
      select 1
      from public.user_follows mine
      join public.user_follows theirs
        on theirs.follower_id = user_id
       and theirs.following_id = auth.uid()
      where mine.follower_id = auth.uid()
        and mine.following_id = travelquest_friend_locations.user_id
    )
  )
);

-- Optional helper for the app: refresh the updated timestamp automatically.
create or replace function public.travelquest_touch_friend_location()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists travelquest_friend_locations_touch on public.travelquest_friend_locations;
create trigger travelquest_friend_locations_touch
before update on public.travelquest_friend_locations
for each row
execute function public.travelquest_touch_friend_location();
