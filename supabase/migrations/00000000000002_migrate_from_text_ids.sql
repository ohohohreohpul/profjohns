-- ============================================================================
-- ProfJohns — Migration from text-ID schema to UUID schema (DB-001/DB-002)
--
-- This migration converts existing tables from text primary keys to UUID
-- primary keys with client_key columns. It preserves all existing data.
--
-- IMPORTANT: Run this ONLY on databases that have the old text-ID schema.
-- For fresh databases, the initial schema migration already has UUIDs.
--
-- Migration sequence:
--   1. Add uuid + client_key columns
--   2. Backfill from existing data
--   3. Create ownership-safe unique constraints
--   4. Update foreign-key references
--   5. Swap primary keys
--   6. Drop obsolete constraints
--
-- ROLLBACK: Before running, take a full database backup:
--   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
-- To rollback: restore from backup.
-- ============================================================================

-- ============================================================================
-- Step 1: Add uuid + client_key + revision + deleted_at columns
-- ============================================================================

alter table public.projects add column if not exists new_id uuid default gen_random_uuid();
alter table public.projects add column if not exists client_key text;
alter table public.projects add column if not exists revision integer not null default 1;
alter table public.projects add column if not exists deleted_at timestamptz;

alter table public.canvases add column if not exists new_id uuid default gen_random_uuid();
alter table public.canvases add column if not exists client_key text;
alter table public.canvases add column if not exists revision integer not null default 1;
alter table public.canvases add column if not exists deleted_at timestamptz;

alter table public.sources add column if not exists new_id uuid default gen_random_uuid();
alter table public.sources add column if not exists client_key text;
alter table public.sources add column if not exists revision integer not null default 1;
alter table public.sources add column if not exists deleted_at timestamptz;

alter table public.agents add column if not exists new_id uuid default gen_random_uuid();
alter table public.agents add column if not exists client_key text;
alter table public.agents add column if not exists revision integer not null default 1;
alter table public.agents add column if not exists deleted_at timestamptz;

alter table public.standing_tasks add column if not exists new_id uuid default gen_random_uuid();
alter table public.standing_tasks add column if not exists client_key text;
alter table public.standing_tasks add column if not exists revision integer not null default 1;
alter table public.standing_tasks add column if not exists deleted_at timestamptz;

alter table public.figures add column if not exists new_id uuid default gen_random_uuid();
alter table public.figures add column if not exists client_key text;
alter table public.figures add column if not exists revision integer not null default 1;
alter table public.figures add column if not exists deleted_at timestamptz;

alter table public.pinned_sources add column if not exists revision integer not null default 1;
alter table public.pinned_sources add column if not exists deleted_at timestamptz;

alter table public.findings add column if not exists revision integer not null default 1;
alter table public.findings add column if not exists deleted_at timestamptz;

alter table public.media add column if not exists client_key text;
alter table public.media add column if not exists revision integer not null default 1;
alter table public.media add column if not exists deleted_at timestamptz;

alter table public.profiles add column if not exists revision integer not null default 1;

-- ============================================================================
-- Step 2: Backfill client_key from existing id column
-- ============================================================================

update public.projects set client_key = id where client_key is null;
update public.canvases set client_key = id where client_key is null;
update public.sources set client_key = id where client_key is null;
update public.agents set client_key = id where client_key is null;
update public.standing_tasks set client_key = id where client_key is null;
update public.figures set client_key = id where client_key is null;
update public.media set client_key = id::text where client_key is null;

-- Ensure no null client_keys remain
alter table public.projects alter column client_key set not null;
alter table public.canvases alter column client_key set not null;
alter table public.sources alter column client_key set not null;
alter table public.agents alter column client_key set not null;
alter table public.standing_tasks alter column client_key set not null;
alter table public.figures alter column client_key set not null;
alter table public.media alter column client_key set not null;

-- ============================================================================
-- Step 3: Create ownership-safe unique constraints
-- ============================================================================

create unique index if not exists projects_user_client_key_idx
  on public.projects (user_id, client_key);

create unique index if not exists canvases_user_client_key_idx
  on public.canvases (user_id, client_key);

create unique index if not exists sources_user_client_key_idx
  on public.sources (user_id, client_key);

create unique index if not exists agents_user_client_key_idx
  on public.agents (user_id, client_key);

create unique index if not exists standing_tasks_user_client_key_idx
  on public.standing_tasks (user_id, client_key);

create unique index if not exists figures_user_client_key_idx
  on public.figures (user_id, client_key);

create unique index if not exists media_user_client_key_idx
  on public.media (user_id, client_key);

-- ============================================================================
-- Step 4: Update foreign-key references
--    Before swapping PKs, we need to update all FK columns from text to uuid.
-- ============================================================================

-- Canvases: project_id text -> uuid
alter table public.canvases alter column project_id type uuid
  using (select new_id from public.projects p where p.id = canvases.project_id);

-- Pinned sources: project_id + source_id text -> uuid
alter table public.pinned_sources alter column project_id type uuid
  using (select new_id from public.projects p where p.id = pinned_sources.project_id);
alter table public.pinned_sources alter column source_id type uuid
  using (select new_id from public.sources s where s.id = pinned_sources.source_id);

-- Media: project_id text -> uuid
alter table public.media alter column project_id type uuid
  using (select new_id from public.projects p where p.id = media.project_id);

-- Standing tasks: project_id text -> uuid, agent_id text -> uuid
alter table public.standing_tasks alter column project_id type uuid
  using (select new_id from public.projects p where p.id = standing_tasks.project_id);
alter table public.standing_tasks alter column agent_id type uuid
  using (select new_id from public.agents a where a.id = standing_tasks.agent_id);

-- Findings: task_id text -> uuid
alter table public.findings alter column task_id type uuid
  using (select new_id from public.standing_tasks t where t.id = findings.task_id);

-- Figures: project_id text -> uuid
alter table public.figures alter column project_id type uuid
  using (select new_id from public.projects p where p.id = figures.project_id);

-- ============================================================================
-- Step 5: Swap primary keys to UUID
-- ============================================================================

-- Drop old text PK and FK constraints, then set UUID PK
alter table public.projects drop constraint projects_pkey;
alter table public.projects add constraint projects_pkey primary key (new_id);
alter table public.projects rename column id to old_id;
alter table public.projects rename column new_id to id;
alter table public.projects alter column id set default gen_random_uuid();

alter table public.canvases drop constraint canvases_pkey;
alter table public.canvases add constraint canvases_pkey primary key (new_id);
alter table public.canvases rename column id to old_id;
alter table public.canvases rename column new_id to id;
alter table public.canvases alter column id set default gen_random_uuid();

alter table public.sources drop constraint sources_pkey;
alter table public.sources add constraint sources_pkey primary key (new_id);
alter table public.sources rename column id to old_id;
alter table public.sources rename column new_id to id;
alter table public.sources alter column id set default gen_random_uuid();

alter table public.agents drop constraint agents_pkey;
alter table public.agents add constraint agents_pkey primary key (new_id);
alter table public.agents rename column id to old_id;
alter table public.agents rename column new_id to id;
alter table public.agents alter column id set default gen_random_uuid();

alter table public.standing_tasks drop constraint standing_tasks_pkey;
alter table public.standing_tasks add constraint standing_tasks_pkey primary key (new_id);
alter table public.standing_tasks rename column id to old_id;
alter table public.standing_tasks rename column new_id to id;
alter table public.standing_tasks alter column id set default gen_random_uuid();

alter table public.figures drop constraint figures_pkey;
alter table public.figures add constraint figures_pkey primary key (new_id);
alter table public.figures rename column id to old_id;
alter table public.figures rename column new_id to id;
alter table public.figures alter column id set default gen_random_uuid();

-- Re-add FK constraints referencing the new uuid PKs
alter table public.canvases
  drop constraint if exists canvases_project_id_fkey,
  add constraint canvases_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete cascade;

alter table public.pinned_sources
  drop constraint if exists pinned_sources_project_id_fkey,
  add constraint pinned_sources_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete cascade;

alter table public.pinned_sources
  drop constraint if exists pinned_sources_source_id_fkey,
  add constraint pinned_sources_source_id_fkey
    foreign key (source_id) references public.sources (id) on delete cascade;

alter table public.media
  drop constraint if exists media_project_id_fkey,
  add constraint media_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.standing_tasks
  drop constraint if exists standing_tasks_project_id_fkey,
  add constraint standing_tasks_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

alter table public.standing_tasks
  drop constraint if exists standing_tasks_agent_id_fkey,
  add constraint standing_tasks_agent_id_fkey
    foreign key (agent_id) references public.agents (id) on delete set null;

alter table public.findings
  drop constraint if exists findings_task_id_fkey,
  add constraint findings_task_id_fkey
    foreign key (task_id) references public.standing_tasks (id) on delete cascade;

alter table public.figures
  drop constraint if exists figures_project_id_fkey,
  add constraint figures_project_id_fkey
    foreign key (project_id) references public.projects (id) on delete set null;

-- ============================================================================
-- Step 6: Update the updated_at trigger to also increment revision
-- ============================================================================
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

-- ============================================================================
-- Step 7: Update match_sources and match_figures to use auth.uid() only
--         (remove the uid parameter)
-- ============================================================================
create or replace function public.match_sources(
  query_embedding vector(384),
  match_count int default 10
)
returns table (
  id uuid,
  title text,
  authors text,
  year int,
  url text,
  abstract text,
  similarity float
)
language sql
stable
security definer set search_path = public
as $$
  select
    s.id, s.title, s.authors, s.year, s.url, s.abstract,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.sources s
  where s.user_id = auth.uid()
    and s.embedding is not null
    and s.deleted_at is null
  order by s.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.match_figures(
  query_embedding vector(768),
  match_count int default 12
)
returns table (id uuid, src text, caption text, similarity float)
language sql
stable
security definer set search_path = public
as $$
  select
    f.id, f.src, f.caption,
    1 - (f.embedding <=> query_embedding) as similarity
  from public.figures f
  where f.user_id = auth.uid()
    and f.embedding is not null
    and f.deleted_at is null
  order by f.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- ============================================================================
-- Step 8: Drop old_id columns (after verification — comment out for staging)
-- ============================================================================
-- WARNING: Only run these after confirming all application code uses UUIDs.
-- For staging migration, leave these commented out for easy rollback.
-- alter table public.projects drop column old_id;
-- alter table public.canvases drop column old_id;
-- alter table public.sources drop column old_id;
-- alter table public.agents drop column old_id;
-- alter table public.standing_tasks drop column old_id;
-- alter table public.figures drop column old_id;

-- ============================================================================
-- Verification queries (run after migration):
-- select tablename from pg_tables where schemaname = 'public' order by 1;
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- select count(*) from public.projects;
-- select count(*) from public.canvases;
-- select count(*) from public.sources;
-- select count(*) from public.agents;
-- select count(*) from public.standing_tasks;
-- select count(*) from public.findings;
-- select count(*) from public.figures;
-- ============================================================================
