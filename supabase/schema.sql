-- ============================================================================
-- ProfJohns — Phase 1 Schema
-- User-scoped: every row belongs to a user. RLS enforces isolation.
-- Run this in the Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profiles — extends auth.users with app-level metadata
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text default '',
  avatar_url text default '',
  -- Account-level app settings (Phase 1).
  style_profile text,                                  -- Lily's learned voice
  home_interests jsonb not null default '[]'::jsonb,   -- Discover tabs
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Settings columns are added idempotently for projects created before Phase 1.
alter table public.profiles add column if not exists style_profile text;
alter table public.profiles add column if not exists home_interests jsonb not null default '[]'::jsonb;

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Projects — a research workspace
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id text primary key,                 -- client-generated id (e.g. proj-<ts>)
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Untitled project',
  direction text not null default '',
  item_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);

-- ----------------------------------------------------------------------------
-- Canvases — a board within a project (nodes + edges + per-node data)
-- ----------------------------------------------------------------------------
create table if not exists public.canvases (
  id text primary key,                 -- client-generated id (e.g. cv-<ts>)
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Main canvas',
  -- The full React Flow state: nodes, edges, per-node data, direction, etc.
  -- Stored as JSONB so the canvas store can sync as a single document.
  state jsonb not null default '{}'::jsonb,
  item_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canvases_project_id_idx on public.canvases (project_id);
create index if not exists canvases_user_id_idx on public.canvases (user_id);

-- ----------------------------------------------------------------------------
-- Sources — a deduped paper/figure record per user
-- ----------------------------------------------------------------------------
create table if not exists public.sources (
  id text primary key,                 -- client PaperSource id
  user_id uuid not null references auth.users (id) on delete cascade,
  -- External identifiers for dedup
  external_id text,          -- DOI, arXiv ID, Semantic Scholar paper ID, etc.
  provider text not null,    -- 'arxiv' | 'semanticscholar' | 'openalex' | 'wikipedia' | 'pdf' | 'link'
  title text not null default '',
  authors text default '',
  year integer,
  venue text default '',
  abstract text default '',
  url text default '',
  open_access boolean default false,
  citations integer,
  concepts jsonb default '[]'::jsonb,
  -- Raw source payload (the full PaperSource object)
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists sources_user_external_idx
  on public.sources (user_id, provider, external_id)
  where external_id is not null;

create index if not exists sources_user_id_idx on public.sources (user_id);

-- ----------------------------------------------------------------------------
-- Pinned sources — a join table: which source is saved to which project
-- ----------------------------------------------------------------------------
create table if not exists public.pinned_sources (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id text not null references public.sources (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, source_id)
);

create index if not exists pinned_sources_project_idx on public.pinned_sources (project_id);
create index if not exists pinned_sources_user_idx on public.pinned_sources (user_id);

-- ----------------------------------------------------------------------------
-- Media — uploaded images / PDFs (metadata; files live in Storage)
-- ----------------------------------------------------------------------------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id text references public.projects (id) on delete set null,
  name text not null default '',
  storage_path text not null,   -- path in the media bucket
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint default 0,
  alt_text text default '',
  credit text default '',
  created_at timestamptz not null default now()
);

create index if not exists media_user_id_idx on public.media (user_id);
create index if not exists media_project_id_idx on public.media (project_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers — keep timestamps fresh
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_projects on public.projects;
create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_canvases on public.canvases;
create trigger touch_canvases before update on public.canvases
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security — user-scoped isolation
-- Every table enforces: a user can only see/modify their own rows.
-- ----------------------------------------------------------------------------

-- Profiles: a user can see and update their own profile only.
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
-- Insert is handled by the trigger (security definer), so no insert policy needed.

-- Projects: full CRUD on own rows.
alter table public.projects enable row level security;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id);
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- Canvases: full CRUD on own rows.
alter table public.canvases enable row level security;
create policy "canvases_select_own" on public.canvases
  for select using (auth.uid() = user_id);
create policy "canvases_insert_own" on public.canvases
  for insert with check (auth.uid() = user_id);
create policy "canvases_update_own" on public.canvases
  for update using (auth.uid() = user_id);
create policy "canvases_delete_own" on public.canvases
  for delete using (auth.uid() = user_id);

-- Sources: full CRUD on own rows.
alter table public.sources enable row level security;
create policy "sources_select_own" on public.sources
  for select using (auth.uid() = user_id);
create policy "sources_insert_own" on public.sources
  for insert with check (auth.uid() = user_id);
create policy "sources_update_own" on public.sources
  for update using (auth.uid() = user_id);
create policy "sources_delete_own" on public.sources
  for delete using (auth.uid() = user_id);

-- Pinned sources: full CRUD on own rows.
alter table public.pinned_sources enable row level security;
create policy "pinned_select_own" on public.pinned_sources
  for select using (auth.uid() = user_id);
create policy "pinned_insert_own" on public.pinned_sources
  for insert with check (auth.uid() = user_id);
create policy "pinned_delete_own" on public.pinned_sources
  for delete using (auth.uid() = user_id);

-- Media: full CRUD on own rows.
alter table public.media enable row level security;
create policy "media_select_own" on public.media
  for select using (auth.uid() = user_id);
create policy "media_insert_own" on public.media
  for insert with check (auth.uid() = user_id);
create policy "media_update_own" on public.media
  for update using (auth.uid() = user_id);
create policy "media_delete_own" on public.media
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Storage bucket — for media uploads (images, PDFs, corpus)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Storage RLS: users can manage files under their own user-id prefix.
create policy "media_storage_own" on storage.objects
  for all
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- Done. Verify with:
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- ----------------------------------------------------------------------------
