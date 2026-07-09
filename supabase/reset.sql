-- ============================================================================
-- ONE-TIME RESET — run this ONCE, then run schema.sql.
--
-- WHY: earlier versions created some tables with `uuid` primary keys. The
-- current schema uses client-generated `text` ids (proj-…, cv-…, task-…), so
-- new tables that reference `projects(id)` as text fail against an old uuid
-- `projects.id`:
--   ERROR: foreign key ... "project_id" and "id" are of incompatible types:
--          text and uuid
--
-- This drops the affected tables so schema.sql can recreate them correctly.
--
-- DANGER: this DELETES the rows in these tables. Safe pre-launch — canvas
-- boards are stored in the browser (the DB copy is a backup and re-syncs),
-- and pinned sources re-upload from local on next sign-in. Do NOT run this
-- against a database whose DB rows are the only copy of real user data.
--
-- `profiles` and `agents` are intentionally left alone (their ids already
-- match the current schema).
-- ============================================================================

drop table if exists public.findings cascade;
drop table if exists public.standing_tasks cascade;
drop table if exists public.figures cascade;
drop table if exists public.pinned_sources cascade;
drop table if exists public.media cascade;
drop table if exists public.canvases cascade;
drop table if exists public.sources cascade;
drop table if exists public.projects cascade;

-- Now run schema.sql to recreate everything with the correct text ids.
