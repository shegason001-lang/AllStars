-- ALL STARS FOOTBALL CLUB REGISTRATION DATABASE
-- Run this in Supabase SQL Editor.
-- After creating your first admin user in Supabase Auth, insert their UUID into public.admins.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.player_registrations (
  registration_id uuid primary key default gen_random_uuid(),
  registration_code text unique not null default ('ASC-P-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  created_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  full_name text not null,
  passport_path text not null,
  date_of_birth date not null,
  gender text,
  phone text not null,
  whatsapp text,
  email text,
  address text not null,
  state text,
  lga text,
  position text not null,
  preferred_foot text,
  height text,
  playing_experience text,
  previous_club text,
  player_category text not null check (player_category in ('Senior','Junior / U16')),
  parent_guardian_name text,
  parent_guardian_phone text,
  emergency_name text not null,
  emergency_phone text not null,
  medical_information text,
  consent boolean not null default false
);

create table if not exists public.management_registrations (
  registration_id uuid primary key default gen_random_uuid(),
  registration_code text unique not null default ('ASC-M-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  created_at timestamptz not null default now(),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  full_name text not null,
  passport_path text not null,
  date_of_birth date,
  gender text,
  role text not null,
  phone text not null,
  whatsapp text,
  email text,
  address text not null,
  experience text,
  qualifications text,
  emergency_name text,
  emergency_phone text,
  other_information text
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid()
  );
$$;

alter table public.admins enable row level security;
alter table public.player_registrations enable row level security;
alter table public.management_registrations enable row level security;

drop policy if exists "Admins can read admins" on public.admins;
create policy "Admins can read admins"
on public.admins for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins manage players" on public.player_registrations;
create policy "Admins manage players"
on public.player_registrations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins manage management" on public.management_registrations;
create policy "Admins manage management"
on public.management_registrations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Private bucket for passport photographs.
insert into storage.buckets (id, name, public)
values ('player-documents', 'player-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Admins read registration documents" on storage.objects;
create policy "Admins read registration documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'player-documents'
  and public.is_admin()
);

-- Uploads are performed by the server with the service-role key.
-- Do NOT create an anonymous storage upload policy.

-- Optional cleanup: prevent accidental direct public table inserts.
-- The registration server uses the service-role key.
