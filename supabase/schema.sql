-- Supabase schema for a self-hosted wedding invitation backend.
-- Run this file in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.invitations (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    slug text not null unique,
    groom_name text not null default '',
    bride_name text not null default '',
    event_date timestamptz,
    location text not null default '',
    description text not null default '',
    groom_photo_url text not null default '',
    bride_photo_url text not null default '',
    audio_url text not null default '',
    cover_urls jsonb not null default '[]'::jsonb,
    gallery_urls jsonb not null default '[]'::jsonb,
    content jsonb not null default '{}'::jsonb,
    timezone text not null default 'Asia/Jakarta',
    is_published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.invitations add column if not exists groom_photo_url text not null default '';
alter table public.invitations add column if not exists bride_photo_url text not null default '';
alter table public.invitations add column if not exists audio_url text not null default '';
alter table public.invitations add column if not exists cover_urls jsonb not null default '[]'::jsonb;
alter table public.invitations add column if not exists gallery_urls jsonb not null default '[]'::jsonb;
alter table public.invitations add column if not exists content jsonb not null default '{}'::jsonb;

create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    invitation_id uuid not null references public.invitations(id) on delete cascade,
    parent_id uuid references public.comments(id) on delete cascade,
    guest_name text not null,
    presence boolean,
    message text not null,
    created_at timestamptz not null default now()
);

create index if not exists invitations_owner_id_idx on public.invitations(owner_id);
create index if not exists comments_invitation_id_idx on public.comments(invitation_id);
create index if not exists comments_parent_id_idx on public.comments(parent_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists invitations_set_updated_at on public.invitations;
create trigger invitations_set_updated_at
before update on public.invitations
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.comments enable row level security;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles
for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists invitations_public_select on public.invitations;
create policy invitations_public_select on public.invitations
for select to anon, authenticated using (is_published = true or owner_id = (select auth.uid()));

drop policy if exists invitations_owner_insert on public.invitations;
create policy invitations_owner_insert on public.invitations
for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists invitations_owner_update on public.invitations;
create policy invitations_owner_update on public.invitations
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists invitations_owner_delete on public.invitations;
create policy invitations_owner_delete on public.invitations
for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists comments_public_select on public.comments;
create policy comments_public_select on public.comments
for select to anon, authenticated using (
    exists (
        select 1 from public.invitations i
        where i.id = invitation_id and i.is_published = true
    )
);

drop policy if exists comments_public_insert on public.comments;
create policy comments_public_insert on public.comments
for insert to anon, authenticated with check (
    exists (
        select 1 from public.invitations i
        where i.id = invitation_id and i.is_published = true
    )
);

drop policy if exists comments_owner_update on public.comments;
create policy comments_owner_update on public.comments
for update to authenticated using (
    exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = (select auth.uid()))
)
with check (
    exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = (select auth.uid()))
);

drop policy if exists comments_owner_delete on public.comments;
create policy comments_owner_delete on public.comments
for delete to authenticated using (
    exists (select 1 from public.invitations i where i.id = invitation_id and i.owner_id = (select auth.uid()))
);

insert into storage.buckets (id, name, public)
values ('invitation-assets', 'invitation-assets', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists invitation_assets_public_read on storage.objects;
create policy invitation_assets_public_read on storage.objects
for select to anon, authenticated using (bucket_id = 'invitation-assets');

drop policy if exists invitation_assets_owner_insert on storage.objects;
create policy invitation_assets_owner_insert on storage.objects
for insert to authenticated with check (
    bucket_id = 'invitation-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists invitation_assets_owner_update on storage.objects;
create policy invitation_assets_owner_update on storage.objects
for update to authenticated using (
    bucket_id = 'invitation-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'invitation-assets' and (storage.foldername(name))[1] = (select auth.uid())::text
);
