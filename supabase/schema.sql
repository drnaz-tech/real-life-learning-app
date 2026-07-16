Exit code: 0
Wall time: 2 seconds
Output:
create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  parent_email text,
  parent_pin_hash text,
  child jsonb not null default '{}'::jsonb,
  completed_mission_ids text[] not null default '{}',
  submissions jsonb not null default '{}'::jsonb,
  level_rewards jsonb not null default '{}'::jsonb,
  approved_rewards jsonb not null default '{}'::jsonb,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.families enable row level security;

drop policy if exists "parents can read their family" on public.families;
create policy "parents can read their family"
  on public.families for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "parents can create their family" on public.families;
create policy "parents can create their family"
  on public.families for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "parents can update their family" on public.families;
create policy "parents can update their family"
  on public.families for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mission-evidence', 'mission-evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "parents can upload their evidence" on storage.objects;
create policy "parents can upload their evidence"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mission-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "parents can read their evidence" on storage.objects;
create policy "parents can read their evidence"
  on storage.objects for select to authenticated
  using (bucket_id = 'mission-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "parents can update their evidence" on storage.objects;
create policy "parents can update their evidence"
  on storage.objects for update to authenticated
  using (bucket_id = 'mission-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'mission-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

