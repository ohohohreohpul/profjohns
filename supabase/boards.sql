-- ============================================================================
-- ProfJohns v2 board model — walls of cards (docs/REBUILD.md §2, §7).
-- Additive: new tables only. `canvases` stays the board row; its `state`
-- blob is the v1 format, read once by the converter and then left alone.
-- Idempotent: safe to re-run. Policies are dropped and recreated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Walls — the titled columns of a board. `kind` gives a wall its meaning
-- (what a card placed in it is for); `custom` walls are user-defined.
-- ----------------------------------------------------------------------------
create table if not exists public.walls (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.canvases (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('question', 'sources', 'reading', 'insights', 'themes', 'draft', 'custom')),
  title text not null,
  -- Fractional ordering: insert between two walls without renumbering.
  position double precision not null default 0,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists walls_board_id_idx on public.walls (board_id, position);

-- ----------------------------------------------------------------------------
-- Cards — one row per card. `data` is the typed payload for `kind`
-- (validated in src/lib/board/schema.ts). Rows, not a blob, so a project's
-- insights are queryable (literature matrix, retrieval while drafting).
-- ----------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.canvases (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  wall_id uuid references public.walls (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('paper', 'insight', 'theme', 'note', 'question', 'draft')),
  position double precision not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_board_id_idx on public.cards (board_id);
create index if not exists cards_wall_position_idx on public.cards (wall_id, position);
create index if not exists cards_project_kind_idx on public.cards (project_id, kind);

-- ----------------------------------------------------------------------------
-- Card links — optional explicit relations between cards. Data does not
-- flow through these (placement does); they record scholarly relations.
-- ----------------------------------------------------------------------------
create table if not exists public.card_links (
  id uuid primary key default gen_random_uuid(),
  board_id text not null references public.canvases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_card uuid not null references public.cards (id) on delete cascade,
  to_card uuid not null references public.cards (id) on delete cascade,
  relation text not null
    check (relation in ('supports', 'contradicts', 'extends', 'cites', 'related')),
  created_at timestamptz not null default now(),
  unique (from_card, to_card, relation),
  check (from_card <> to_card)
);

create index if not exists card_links_board_id_idx on public.card_links (board_id);

-- ----------------------------------------------------------------------------
-- updated_at maintenance (reuses public.touch_updated_at from schema.sql).
-- ----------------------------------------------------------------------------
drop trigger if exists touch_walls on public.walls;
create trigger touch_walls before update on public.walls
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_cards on public.cards;
create trigger touch_cards before update on public.cards
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — every row belongs to its user AND to a board that user owns.
-- Checking user_id alone would let a user attach rows to someone else's
-- board by id (foreign keys only check existence, not ownership).
-- ----------------------------------------------------------------------------
alter table public.walls enable row level security;
alter table public.cards enable row level security;
alter table public.card_links enable row level security;

create or replace function public.owns_board(board text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.canvases c where c.id = board and c.user_id = auth.uid()
  );
$$;

do $$
declare
  t text;
  own text := 'auth.uid() = user_id and public.owns_board(board_id)';
begin
  foreach t in array array['walls', 'cards', 'card_links'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (%s)',
      t || '_insert_own', t, own);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (%s)',
      t || '_update_own', t, own);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      t || '_delete_own', t);
  end loop;
end $$;

-- A link may only join two cards on its own board.
create or replace function public.card_link_same_board()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.cards a join public.cards b on a.board_id = b.board_id
    where a.id = new.from_card and b.id = new.to_card and a.board_id = new.board_id
  ) then
    raise exception 'card_links must connect two cards on board %', new.board_id;
  end if;
  return new;
end;
$$;

drop trigger if exists card_links_same_board on public.card_links;
create trigger card_links_same_board before insert or update on public.card_links
  for each row execute function public.card_link_same_board();

-- A card's wall must belong to the card's own board.
create or replace function public.card_wall_same_board()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.wall_id is not null and not exists (
    select 1 from public.walls w where w.id = new.wall_id and w.board_id = new.board_id
  ) then
    raise exception 'card wall % is not on board %', new.wall_id, new.board_id;
  end if;
  return new;
end;
$$;

drop trigger if exists cards_wall_same_board on public.cards;
create trigger cards_wall_same_board before insert or update on public.cards
  for each row execute function public.card_wall_same_board();

-- ----------------------------------------------------------------------------
-- Board format version: 1 = v1 canvas (state blob), 2 = walls of cards.
-- The one-time converter claims a board by flipping 1 -> 2 with a
-- conditional update, so two open tabs can never convert it twice.
-- ----------------------------------------------------------------------------
alter table public.canvases add column if not exists board_version smallint not null default 1;

-- One wall of each built-in kind per board. Two loads racing to create the
-- default walls (e.g. a re-render mid-load) can't produce duplicates: the
-- second insert fails and the repository re-reads the winner's walls.
create unique index if not exists walls_board_kind_unique
  on public.walls (board_id, kind) where kind <> 'custom';
