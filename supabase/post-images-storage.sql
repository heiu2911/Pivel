-- TravelQuest: configure the public post image bucket.
-- Run this in Supabase Dashboard -> SQL Editor for the project used by Vercel.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'post-images',
  'post-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The app uploads images under posts/<deviceId>-<timestamp>.<extension>.
-- Only signed-in users may upload; images are publicly readable because this is a public bucket.
drop policy if exists "TravelQuest authenticated post image uploads" on storage.objects;

create policy "TravelQuest authenticated post image uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = 'posts'
);
