# Backend Phase 1 — Persistence Foundation (execution plan)

> The unlock. Replace localStorage-as-source-of-truth with Supabase Postgres,
> per user, so the workspace is multi-device and every later phase (agents,
> background runs, retrieval) has a server brain to build on. No new user-facing
> feature — but nothing below it is possible without it.
> Companion to `VISION.md` (§4 data model, §6 roadmap) and `supabase/schema.sql`.

## Where we are
- **Auth: done.** Supabase `@supabase/ssr`, login/signup, `proxy.ts` session
  refresh, `AuthProvider`/`AuthGuard`. RLS-ready.
- **Schema: drafted, not wired.** `supabase/schema.sql` defines `profiles`,
  `projects`, `canvases (state jsonb)`, `sources`, `pinned_sources`, `media` +
  RLS + a `media` storage bucket. No client code reads/writes it yet.
- **Source of truth: still localStorage.** `lattice-workspace` (projects,
  canvases, pinnedSources, homeInterests, **styleProfile**) and
  `lattice-canvas-v1::<id>` (one JSONB-shaped blob per board: nodes, edges,
  docs as TipTap JSON, per-node synthesis, sources map, highlights).

## What the canvas blob already gives us
The board persists as **one object** today. `canvases.state jsonb` maps to it
1:1 — TipTap docs, structured synthesis on `processor` nodes, the sources map,
and highlights all ride inside `state`. So Phase 1 does **not** need per-node
tables; sync the whole `state` blob per canvas (debounced). Normalize only
`sources`/`pinned_sources` (already in the schema) for later cross-project +
retrieval use.

## Schema delta (small)
Everything current is covered except two account-level bits that live in
`lattice-workspace`:
1. **`style_profile text`** (Lily) — add to `profiles`, or a `user_settings`
   row. (Decision A below.)
2. **`home_interests jsonb`** (Discover tabs) — same place as above.
3. (Later phases add: `agents`, `standing_tasks`, `runs`, `findings`, and
   `embedding vector` columns via pgvector — **out of scope for Phase 1**.)

## Client data layer
Introduce a thin repository under `src/lib/db/` (one module per entity:
`projects.ts`, `canvases.ts`, `sources.ts`, `settings.ts`) wrapping the Supabase
client. The Zustand stores keep their shape but change where they load/persist:

- **workspace-store** → on hydrate, `select` projects/canvases/pinned/settings
  for `auth.uid()`; mutations write through the repo (and mirror to localStorage
  as an offline cache). 
- **canvas-store** → load a canvas's `state` from `canvases.state`; persist the
  blob back **debounced** (~800ms–1.5s) on change. localStorage stays as the
  fast local cache + offline fallback; DB is the source of truth.
- Keep `skipHydration` + the existing `hasHydrated` gating; just swap the
  storage backend behind it.

## One-time migration (existing local users)
On first authenticated load: if the DB has no projects for this user **and**
localStorage has data, push local → DB (projects → canvases → pinned →
settings), then set a `migrated` marker. Idempotent; never auto-deletes local.

## Sequencing (within Phase 1)
1. Schema delta + apply `schema.sql` to the Supabase project (verify RLS).
2. `src/lib/db/` repos + a `useSession`-aware data provider.
3. Wire **workspace-store** (projects/canvases/pinned/settings) read+write.
4. Wire **canvas-store** (`state` blob load + debounced save).
5. One-time localStorage→DB migration on first login.
6. Verify: sign in on two browsers → same workspace; edit a draft → persists
   server-side; sign out/in → intact; RLS denies cross-user reads.

## Risks / open decisions
- **The leap:** committing to a backend makes this a *service* (ops, cost,
  privacy, deletion). VISION §7 says decide deliberately — this is that point.
- **Canvas blob size:** base64 images in `media` nodes bloat `state`. Phase 1
  can keep them inline; a follow-up moves media bytes to Storage (bucket exists)
  and stores only a path in `state`.
- **Multi-tab/last-write-wins:** debounced whole-blob save is last-writer-wins.
  Acceptable for single-user/few-tabs; revisit if collaboration is wanted.
- **Privacy:** the user's corpus (Lily training, uploads) is sensitive — RLS +
  per-user Storage prefix already in `schema.sql`; keep deletion first-class.

### Decisions to confirm
- **A. Settings home:** `style_profile`/`home_interests` as columns on
  `profiles`, **or** a dedicated `user_settings` table? (Lean: columns on
  `profiles` — fewer tables, 1:1 with user.)
- **B. Phase 1 boundary:** persistence only (recommended), or fold in the
  Agents surface (Phase 2) at the same time?
- **C. Go/no-go on the leap now**, vs. keep shipping canvas polish first.
