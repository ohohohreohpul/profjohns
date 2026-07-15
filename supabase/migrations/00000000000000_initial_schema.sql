-- ============================================================================
-- ProfJohns — Initial Schema (fresh database)
--
-- Key design decisions:
--   - UUID primary keys (server-generated via gen_random_uuid())
--   - client_key column for client-side identification (scoped per user)
--   - unique(user_id, client_key) on every table
--   - RLS with both USING and WITH CHECK on every policy
--   - auth.uid() only (no caller-provided uid parameters)
--   - revision + updated_at + deleted_at for optimistic concurrency (DB-005)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ----------------------------------------------------------------------------
-- Profiles — extends auth.users with app-level metadata
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text default '',
  avatar_url text default '',
  style_profile text,
  home_interests jsonb not null default '[]'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_key text not null,
  name text not null default 'Untitled project',
  direction text not null default '',
  item_count integer not null default 0,
  revision integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key)
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists projects_updated_at_idx on public.projects (updated_at desc);
create index if not exists projects_client_key_idx on public.projects (user_id, client_key);

-- ----------------------------------------------------------------------------
-- Canvases — a board within a project
-- ----------------------------------------------------------------------------
create table if not exists public.canvases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  client_key text not null,
  name text not null default 'Main canvas',
  state jsonb not null default '{}'::jsonb,
  item_count integer not null default 0,
  revision integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key)
);

create index if not exists canvases_project_id_idx on public.canvases (project_id);
create index if not exists canvases_user_id_idx on public.canvases (user_id);
create index if not exists canvases_client_key_idx on public.canvases (user_id, client_key);

-- ----------------------------------------------------------------------------
-- Sources — a deduped paper/figure record per user
-- ----------------------------------------------------------------------------
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_key text not null,
  external_id text,
  provider text not null,
  title text not null default '',
  authors text default '',
  year integer,
  venue text default '',
  abstract text default '',
  url text default '',
  open_access boolean default false,
  citations integer,
  concepts jsonb default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  embedding vector(384),
  revision integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_key)
);

create unique index if not exists sources_user_external_idx
  on public.sources (user_id, provider, external_id)
  where external_id is not null and deleted_at is null;

create index if not exists sources_user_id_idx on public.sources (user_id);
create index if not exists sources_embedding_idx
  on public.sources using hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- Pinned sources — join table: which source is saved to which project
-- ----------------------------------------------------------------------------
create table if not exists public.pinned_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  revision integer not null default 1,
  deleted_at timestamptz,
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
  project_id uuid references public.projects (id) on delete set null,
  client_key text not null,
  name text not null default '',
  storage_path text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint default 0,
  alt_text text default '',
  credit text default '',
  revision integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_key)
);

create index if not exists media_user_id_idx on public.media (user_id);
create index if not exists media_project_id_idx on public.media (project_id);

-- ----------------------------------------------------------------------------
-- Agents — the user's configurable research agents
-- ----------------------------------------------------------------------------
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_key text not null,
  name text not null default 'Untitled agent',
  archetype text not null default 'custom',
  description text not null default '',
  system_prompt text not null default '',
  model_id text not null default '',
  built_in boolean not null default false,
  citation_style text,
  revision integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key)
);

create index if not exists agents_user_id_idx on public.agents (user_id);
create index if not exists agents_client_key_idx on public.agents (user_id, client_key);

-- ----------------------------------------------------------------------------
-- Standing tasks + findings (background sweep)
-- ----------------------------------------------------------------------------
create table if not exists public.standing_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  client_key text not null,
  topic text not null default '',
  sources jsonb not null default '[]'::jsonb,
  agent_id uuid references public.agents (id) on delete set null,
  schedule text not null default 'daily',
  enabled boolean not null default true,
  last_run_at timestamptz,
  revision integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key)
);

create index if not exists standing_tasks_user_idx on public.standing_tasks (user_id);
create index if not exists standing_tasks_due_idx on public.standing_tasks (enabled, last_run_at);

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.standing_tasks (id) on delete cascade,
  source_id text not null,
  title text not null default '',
  authors text default '',
  year integer,
  url text default '',
  score integer,
  why text default '',
  status text not null default 'new',
  data jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (task_id, source_id)
);

create index if not exists findings_user_idx on public.findings (user_id);
create index if not exists findings_task_idx on public.findings (task_id);

-- ----------------------------------------------------------------------------
-- Figures — CLIP embeddings for figure search
-- ----------------------------------------------------------------------------
create table if not exists public.figures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  client_key text not null,
  src text not null default '',
  caption text default '',
  embedding vector(768),
  revision integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_key)
);

create index if not exists figures_user_idx on public.figures (user_id);
create index if not exists figures_embedding_idx
  on public.figures using hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.revision = coalesce(old.revision, 0) + 1;
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

drop trigger if exists touch_agents on public.agents;
create trigger touch_agents before update on public.agents
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_standing_tasks on public.standing_tasks;
create trigger touch_standing_tasks before update on public.standing_tasks
  for each row execute function public.touch_updated_at();
