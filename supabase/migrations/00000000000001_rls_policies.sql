-- ============================================================================
-- ProfJohns — RLS Policies (DB-003)
--
-- Every policy uses auth.uid() exclusively (no caller-provided uid).
-- Every update policy has both USING and WITH CHECK.
-- Privileged functions are restricted to authenticated role.
-- Public privileges revoked.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enable RLS on all tables
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.canvases enable row level security;
alter table public.sources enable row level security;
alter table public.pinned_sources enable row level security;
alter table public.media enable row level security;
alter table public.agents enable row level security;
alter table public.standing_tasks enable row level security;
alter table public.findings enable row level security;
alter table public.figures enable row level security;

-- ----------------------------------------------------------------------------
-- Profiles
-- ----------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- Projects
-- ----------------------------------------------------------------------------
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Canvases
-- ----------------------------------------------------------------------------
drop policy if exists "canvases_select_own" on public.canvases;
create policy "canvases_select_own" on public.canvases
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "canvases_insert_own" on public.canvases;
create policy "canvases_insert_own" on public.canvases
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "canvases_update_own" on public.canvases;
create policy "canvases_update_own" on public.canvases
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "canvases_delete_own" on public.canvases;
create policy "canvases_delete_own" on public.canvases
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Sources
-- ----------------------------------------------------------------------------
drop policy if exists "sources_select_own" on public.sources;
create policy "sources_select_own" on public.sources
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "sources_insert_own" on public.sources;
create policy "sources_insert_own" on public.sources
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "sources_update_own" on public.sources;
create policy "sources_update_own" on public.sources
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sources_delete_own" on public.sources;
create policy "sources_delete_own" on public.sources
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Pinned sources
-- ----------------------------------------------------------------------------
drop policy if exists "pinned_select_own" on public.pinned_sources;
create policy "pinned_select_own" on public.pinned_sources
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pinned_insert_own" on public.pinned_sources;
create policy "pinned_insert_own" on public.pinned_sources
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pinned_update_own" on public.pinned_sources;
create policy "pinned_update_own" on public.pinned_sources
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pinned_delete_own" on public.pinned_sources;
create policy "pinned_delete_own" on public.pinned_sources
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Media
-- ----------------------------------------------------------------------------
drop policy if exists "media_select_own" on public.media;
create policy "media_select_own" on public.media
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "media_insert_own" on public.media;
create policy "media_insert_own" on public.media
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "media_update_own" on public.media;
create policy "media_update_own" on public.media
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "media_delete_own" on public.media;
create policy "media_delete_own" on public.media
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Agents
-- ----------------------------------------------------------------------------
drop policy if exists "agents_select_own" on public.agents;
create policy "agents_select_own" on public.agents
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "agents_insert_own" on public.agents;
create policy "agents_insert_own" on public.agents
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "agents_update_own" on public.agents;
create policy "agents_update_own" on public.agents
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "agents_delete_own" on public.agents;
create policy "agents_delete_own" on public.agents
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Standing tasks
-- ----------------------------------------------------------------------------
drop policy if exists "tasks_select_own" on public.standing_tasks;
create policy "tasks_select_own" on public.standing_tasks
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.standing_tasks;
create policy "tasks_insert_own" on public.standing_tasks
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.standing_tasks;
create policy "tasks_update_own" on public.standing_tasks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.standing_tasks;
create policy "tasks_delete_own" on public.standing_tasks
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Findings
-- ----------------------------------------------------------------------------
drop policy if exists "findings_select_own" on public.findings;
create policy "findings_select_own" on public.findings
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "findings_insert_own" on public.findings;
create policy "findings_insert_own" on public.findings
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "findings_update_own" on public.findings;
create policy "findings_update_own" on public.findings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "findings_delete_own" on public.findings;
create policy "findings_delete_own" on public.findings
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Figures
-- ----------------------------------------------------------------------------
drop policy if exists "figures_select_own" on public.figures;
create policy "figures_select_own" on public.figures
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "figures_insert_own" on public.figures;
create policy "figures_insert_own" on public.figures
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "figures_update_own" on public.figures;
create policy "figures_update_own" on public.figures
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "figures_delete_own" on public.figures;
create policy "figures_delete_own" on public.figures
  for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Semantic search RPCs — auth.uid() only, no uid parameter
-- ----------------------------------------------------------------------------
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

-- Restrict function execution to authenticated role only
revoke execute on function public.match_sources(vector(384), int) from public;
grant execute on function public.match_sources(vector(384), int) to authenticated;

revoke execute on function public.match_figures(vector(768), int) from public;
grant execute on function public.match_figures(vector(768), int) to authenticated;

-- Revoke unnecessary public privileges
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ----------------------------------------------------------------------------
-- Storage bucket + RLS
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "media_storage_select_own" on storage.objects;
create policy "media_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_storage_insert_own" on storage.objects;
create policy "media_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_storage_update_own" on storage.objects;
create policy "media_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media_storage_delete_own" on storage.objects;
create policy "media_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
