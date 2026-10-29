-- Traveller Chat: persistent direct messages across accounts and devices.
-- Run this once in Supabase SQL Editor for the TravelQuest project.

create table if not exists public.travelquest_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default 'Traveller',
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint travelquest_chat_not_self check (sender_id <> recipient_id)
);

create index if not exists travelquest_chat_sender_created_idx
  on public.travelquest_chat_messages (sender_id, created_at desc);
create index if not exists travelquest_chat_recipient_created_idx
  on public.travelquest_chat_messages (recipient_id, created_at desc);

alter table public.travelquest_chat_messages enable row level security;

drop policy if exists "Users can read their own chat messages" on public.travelquest_chat_messages;
create policy "Users can read their own chat messages"
  on public.travelquest_chat_messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send chat messages as themselves" on public.travelquest_chat_messages;
create policy "Users can send chat messages as themselves"
  on public.travelquest_chat_messages
  for insert
  to authenticated
  with check (auth.uid() = sender_id and sender_id <> recipient_id);
