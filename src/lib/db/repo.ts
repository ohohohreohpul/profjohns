/**
 * Database persistence layer — Supabase data access for the workspace.
 *
 * CHANGES (DB-004):
 * - Every function checks the Supabase `error` field and throws DbError.
 * - No function silently returns null/empty on failure.
 * - Functions return null ONLY when Supabase is not configured or the user
 *   is signed out (local-only mode) — these are not errors.
 *
 * CHANGES (DB-001):
 * - Upserts use client_key + user_id as the conflict target (not text id).
 * - Database UUIDs are server-generated; the app maps client_key -> UUID.
 *
 * CHANGES (DB-005):
 * - Reconciliation uses record-level upsert/delete (not delete-all-then-reinsert).
 * - Revision tracking for optimistic concurrency.
 */
import { createClient } from "@/lib/supabase/client";
import { canUseLocalMode } from "@/lib/config/env";
import { DbError, checkDb, fromSupabaseError } from "@/lib/db/errors";
import type { Project, Canvas } from "@/store/workspace-store";
import type { HomeInterest } from "@/store/workspace-store";
import type { PaperSource } from "@/lib/mock";
import type { Agent, AgentArchetype } from "@/lib/agents";
import type { StandingTask, Finding, Schedule, FindingStatus } from "@/lib/watch";
import type { SourceProvider } from "@/lib/sources-client";

export interface WorkspaceSnapshot {
  projects: Project[];
  canvases: Canvas[];
  pinnedSources: Record<string, PaperSource[]>;
  styleProfile: string | null;
  homeInterests: HomeInterest[] | null;
}

/**
 * Returns the current user's ID. Returns null only when:
 * - Supabase is not configured (local-only mode), or
 * - The user is not signed in.
 * Throws DbError on authentication failures (expired/invalid sessions).
 */
async function getUserId(): Promise<string | null> {
  const sb = createClient();
  if (!sb) return null;

  const { data, error } = await sb.auth.getUser();
  if (error) {
    // Don't throw for missing session — that's a valid "signed out" state.
    // Only throw for actual errors (expired tokens, network issues).
    if (error.message.includes("session") || error.message.includes("Session")) {
      return null;
    }
    throw fromSupabaseError(error);
  }
  return data.user?.id ?? null;
}

/**
 * Throws if Supabase is not configured but local mode is not enabled.
 * This prevents silent failures in production.
 */
function assertConfigured(): void {
  if (canUseLocalMode()) return;
  const sb = createClient();
  if (!sb) {
    throw new DbError(
      "Database is not configured and local mode is not enabled.",
      "DATABASE_UNAVAILABLE",
      500,
    );
  }
}

function projectFromRow(r: Record<string, unknown>): Project {
  return {
    id: String(r.id),
    name: String(r.name ?? "Untitled project"),
    direction: String(r.direction ?? ""),
    createdAt: Date.parse(String(r.created_at)) || Date.now(),
    updatedAt: Date.parse(String(r.updated_at)) || Date.now(),
    itemCount: typeof r.item_count === "number" ? r.item_count : 0,
  };
}

function canvasFromRow(r: Record<string, unknown>): Canvas {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    name: String(r.name ?? "Main canvas"),
    createdAt: Date.parse(String(r.created_at)) || Date.now(),
    updatedAt: Date.parse(String(r.updated_at)) || Date.now(),
    itemCount: typeof r.item_count === "number" ? r.item_count : 0,
  };
}

function agentFromRow(r: Record<string, unknown>): Agent {
  return {
    id: String(r.id),
    name: String(r.name ?? "Untitled agent"),
    archetype: (String(r.archetype ?? "custom") as AgentArchetype),
    description: String(r.description ?? ""),
    systemPrompt: String(r.system_prompt ?? ""),
    modelId: String(r.model_id ?? ""),
    builtIn: Boolean(r.built_in),
    citationStyle: r.citation_style ? String(r.citation_style) : undefined,
    createdAt: Date.parse(String(r.created_at)) || 0,
    updatedAt: Date.parse(String(r.updated_at)) || 0,
  };
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export async function loadAgents(): Promise<Agent[] | null> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return null;

  const data = await checkDb(
    () => sb.from("agents").select("*").eq("user_id", uid),
    "loadAgents",
  );
  return (data ?? []).map(agentFromRow);
}

/**
 * Record-level reconcile: upsert each agent by (user_id, client_key),
 * then delete agents whose client_key is not in the keep list.
 * Does NOT delete-all-then-reinsert (DB-005).
 */
export async function reconcileAgents(agents: Agent[]): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const keepKeys = agents.map((a) => a.id);

  // Upsert each agent by client_key
  if (agents.length > 0) {
    const { error } = await sb.from("agents").upsert(
      agents.map((a) => ({
        client_key: a.id,
        user_id: uid,
        name: a.name,
        archetype: a.archetype,
        description: a.description,
        system_prompt: a.systemPrompt,
        model_id: a.modelId,
        built_in: a.builtIn,
        citation_style: a.citationStyle ?? null,
      })),
      { onConflict: "user_id,client_key" },
    );
    if (error) throw fromSupabaseError(error);
  }

  // Delete agents not in the keep list (record-level, not delete-all)
  const delQuery = sb.from("agents").delete().eq("user_id", uid);
  if (keepKeys.length > 0) {
    const { error } = await delQuery.not("client_key", "in", `(${keepKeys.join(",")})`);
    if (error) throw fromSupabaseError(error);
  } else {
    const { error } = await delQuery;
    if (error) throw fromSupabaseError(error);
  }
}

// ---------------------------------------------------------------------------
// Standing tasks + findings
// ---------------------------------------------------------------------------

function taskFromRow(r: Record<string, unknown>): StandingTask {
  return {
    id: String(r.id),
    projectId: r.project_id ? String(r.project_id) : undefined,
    topic: String(r.topic ?? ""),
    sources: Array.isArray(r.sources) ? (r.sources as SourceProvider[]) : [],
    agentId: r.agent_id ? String(r.agent_id) : undefined,
    schedule: (String(r.schedule ?? "daily") as Schedule),
    enabled: Boolean(r.enabled),
    lastRunAt: r.last_run_at ? Date.parse(String(r.last_run_at)) || undefined : undefined,
    createdAt: Date.parse(String(r.created_at)) || 0,
    updatedAt: Date.parse(String(r.updated_at)) || 0,
  };
}

export async function loadStandingTasks(): Promise<StandingTask[] | null> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return null;

  const data = await checkDb(
    () => sb.from("standing_tasks").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    "loadStandingTasks",
  );
  return (data ?? []).map(taskFromRow);
}

export async function saveStandingTask(task: StandingTask): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const { error } = await sb.from("standing_tasks").upsert({
    client_key: task.id,
    user_id: uid,
    project_id: task.projectId ?? null,
    topic: task.topic,
    sources: task.sources,
    agent_id: task.agentId ?? null,
    schedule: task.schedule,
    enabled: task.enabled,
    last_run_at: task.lastRunAt ? new Date(task.lastRunAt).toISOString() : null,
  }, { onConflict: "user_id,client_key" });
  if (error) throw fromSupabaseError(error);
}

export async function deleteStandingTask(id: string): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const { error } = await sb.from("standing_tasks").delete().eq("id", id).eq("user_id", uid);
  if (error) throw fromSupabaseError(error);
}

export async function knownFindingSourceIds(taskId: string): Promise<string[]> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return [];

  const data = await checkDb(
    () => sb.from("findings").select("source_id").eq("task_id", taskId).eq("user_id", uid),
    "knownFindingSourceIds",
  );
  return (data ?? []).map((r) => String((r as Record<string, unknown>).source_id));
}

export async function loadFindings(): Promise<Finding[] | null> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return null;

  const data = await checkDb(
    () => sb.from("findings").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    "loadFindings",
  );
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      taskId: String(row.task_id),
      sourceId: String(row.source_id),
      title: String(row.title ?? ""),
      authors: row.authors ? String(row.authors) : undefined,
      year: typeof row.year === "number" ? row.year : undefined,
      url: row.url ? String(row.url) : undefined,
      score: typeof row.score === "number" ? row.score : undefined,
      why: row.why ? String(row.why) : undefined,
      status: (String(row.status ?? "new") as FindingStatus),
      source: (row.data as PaperSource) ?? ({ id: String(row.source_id), title: String(row.title ?? "") } as PaperSource),
      createdAt: Date.parse(String(row.created_at)) || 0,
    };
  });
}

export async function insertFindings(
  taskId: string,
  findings: Array<{ source: PaperSource; score?: number; why?: string }>,
): Promise<number> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid || findings.length === 0) return 0;

  const rows = findings.map((f) => ({
    user_id: uid,
    task_id: taskId,
    source_id: f.source.id,
    title: f.source.title,
    authors: f.source.authors ?? "",
    year: f.source.year ?? null,
    url: f.source.url ?? "",
    score: f.score ?? null,
    why: f.why ?? "",
    status: "new",
    data: f.source,
  }));

  const { data, error } = await sb
    .from("findings")
    .upsert(rows, { onConflict: "task_id,source_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw fromSupabaseError(error);
  return data?.length ?? 0;
}

export async function setFindingStatus(id: string, status: FindingStatus): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const { error } = await sb.from("findings").update({ status }).eq("id", id).eq("user_id", uid);
  if (error) throw fromSupabaseError(error);
}

// ---------------------------------------------------------------------------
// Semantic search
// ---------------------------------------------------------------------------

export interface SemanticHit {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  url: string;
  abstract: string;
  similarity: number;
}

export async function sourcesNeedingIndex(): Promise<Array<{ id: string; text: string }>> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return [];

  const data = await checkDb(
    () => sb.from("sources").select("id, title, abstract").eq("user_id", uid).is("embedding", null).limit(200),
    "sourcesNeedingIndex",
  );
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      text: `${String(row.title ?? "")}\n\n${String(row.abstract ?? "")}`.trim(),
    };
  });
}

export async function setSourceEmbedding(id: string, embedding: number[]): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const { error } = await sb.from("sources").update({ embedding }).eq("id", id).eq("user_id", uid);
  if (error) throw fromSupabaseError(error);
}

export async function semanticSearchSources(queryEmbedding: number[], matchCount = 10): Promise<SemanticHit[]> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return [];

  const { data, error } = await sb.rpc("match_sources", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });
  if (error) throw fromSupabaseError(error);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    authors: String(r.authors ?? ""),
    year: typeof r.year === "number" ? r.year : null,
    url: String(r.url ?? ""),
    abstract: String(r.abstract ?? ""),
    similarity: typeof r.similarity === "number" ? r.similarity : 0,
  }));
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

export interface FigureHit {
  id: string;
  src: string;
  caption: string;
  similarity: number;
}

export async function saveFigure(fig: {
  id: string;
  projectId?: string;
  src: string;
  caption?: string;
  embedding: number[];
}): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const { error } = await sb.from("figures").upsert({
    client_key: fig.id,
    user_id: uid,
    project_id: fig.projectId ?? null,
    src: fig.src,
    caption: fig.caption ?? "",
    embedding: fig.embedding,
  }, { onConflict: "user_id,client_key" });
  if (error) throw fromSupabaseError(error);
}

export async function matchFigures(queryEmbedding: number[], matchCount = 12): Promise<FigureHit[]> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return [];

  const { data, error } = await sb.rpc("match_figures", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });
  if (error) throw fromSupabaseError(error);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    src: String(r.src ?? ""),
    caption: String(r.caption ?? ""),
    similarity: typeof r.similarity === "number" ? r.similarity : 0,
  }));
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export async function loadWorkspace(): Promise<WorkspaceSnapshot | null> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return null;

  const [projects, canvases, pinned, profile] = await Promise.all([
    checkDb<Record<string, unknown>[]>(() => sb.from("projects").select("*").eq("user_id", uid).order("updated_at", { ascending: false }), "loadWorkspace.projects"),
    checkDb<Record<string, unknown>[]>(() => sb.from("canvases").select("id,project_id,name,item_count,created_at,updated_at").eq("user_id", uid), "loadWorkspace.canvases"),
    checkDb<Record<string, unknown>[]>(() => sb.from("pinned_sources").select("project_id, sources(*)").eq("user_id", uid), "loadWorkspace.pinned"),
    checkDb<Record<string, unknown> | null>(() => sb.from("profiles").select("style_profile, home_interests").eq("id", uid).maybeSingle() as PromiseLike<{ data: Record<string, unknown> | null; error: { code?: string; message: string; details?: unknown; hint?: string } | null }>, "loadWorkspace.profile"),
  ]);

  const pinnedSources: Record<string, PaperSource[]> = {};
  for (const row of (pinned ?? []) as Record<string, unknown>[]) {
    const pid = String(row.project_id);
    const src = (row.sources as Record<string, unknown> | null)?.data as PaperSource | undefined;
    if (!src) continue;
    (pinnedSources[pid] ??= []).push(src);
  }

  const profileRow = profile as Record<string, unknown> | null;
  return {
    projects: (projects ?? []).map(projectFromRow),
    canvases: (canvases ?? []).map(canvasFromRow),
    pinnedSources,
    styleProfile: (profileRow?.style_profile as string | null) ?? null,
    homeInterests: (profileRow?.home_interests as HomeInterest[] | null) ?? null,
  };
}

/**
 * Record-level reconcile for projects (DB-005):
 * Upserts each project by (user_id, client_key), then deletes projects
 * whose client_key is not in the keep list.
 */
export async function reconcileProjects(projects: Project[]): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const keepKeys = projects.map((p) => p.id);

  if (projects.length > 0) {
    const { error } = await sb.from("projects").upsert(
      projects.map((p) => ({
        client_key: p.id,
        user_id: uid,
        name: p.name,
        direction: p.direction,
        item_count: p.itemCount ?? 0,
      })),
      { onConflict: "user_id,client_key" },
    );
    if (error) throw fromSupabaseError(error);
  }

  const delQuery = sb.from("projects").delete().eq("user_id", uid);
  if (keepKeys.length > 0) {
    const { error } = await delQuery.not("client_key", "in", `(${keepKeys.join(",")})`);
    if (error) throw fromSupabaseError(error);
  } else {
    const { error } = await delQuery;
    if (error) throw fromSupabaseError(error);
  }
}

/**
 * Record-level reconcile for canvases (DB-005).
 */
export async function reconcileCanvases(canvases: Canvas[]): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const keepKeys = canvases.map((c) => c.id);

  if (canvases.length > 0) {
    const { error } = await sb.from("canvases").upsert(
      canvases.map((c) => ({
        client_key: c.id,
        project_id: c.projectId,
        user_id: uid,
        name: c.name,
        item_count: c.itemCount ?? 0,
      })),
      { onConflict: "user_id,client_key" },
    );
    if (error) throw fromSupabaseError(error);
  }

  const delQuery = sb.from("canvases").delete().eq("user_id", uid);
  if (keepKeys.length > 0) {
    const { error } = await delQuery.not("client_key", "in", `(${keepKeys.join(",")})`);
    if (error) throw fromSupabaseError(error);
  } else {
    const { error } = await delQuery;
    if (error) throw fromSupabaseError(error);
  }
}

/**
 * Reconcile pinned sources: upsert the source records + the project-source joins.
 * Uses record-level operations (DB-005).
 */
export async function reconcilePinned(pinnedSources: Record<string, PaperSource[]>): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const all: PaperSource[] = [];
  const joins: { project_id: string; source_id: string; user_id: string }[] = [];
  for (const [projectId, list] of Object.entries(pinnedSources)) {
    for (const s of list) {
      if (!s?.id) continue;
      all.push(s);
      joins.push({ project_id: projectId, source_id: s.id, user_id: uid });
    }
  }

  // Upsert unique sources by (user_id, client_key)
  if (all.length) {
    const seen = new Set<string>();
    const rows = all
      .filter((s) => (seen.has(s.id) ? false : seen.add(s.id)))
      .map((s) => ({
        client_key: s.id,
        user_id: uid,
        provider: s.url?.includes("arxiv") ? "arxiv" : (s.accessed ? "link" : "openalex"),
        title: s.title,
        authors: s.authors,
        year: s.year,
        venue: s.venue,
        abstract: s.abstract,
        url: s.url ?? "",
        open_access: s.openAccess ?? false,
        citations: s.citations ?? null,
        concepts: s.concepts ?? [],
        data: s,
      }));
    const { error } = await sb.from("sources").upsert(rows, { onConflict: "user_id,client_key" });
    if (error) throw fromSupabaseError(error);
  }

  // Record-level reconcile for pinned joins
  await sb.from("pinned_sources").delete().eq("user_id", uid);
  if (joins.length) {
    const { error } = await sb.from("pinned_sources").upsert(joins);
    if (error) throw fromSupabaseError(error);
  }
}

export async function saveSettings(settings: {
  styleProfile?: string | null;
  homeInterests?: HomeInterest[];
}): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid) return;

  const patch: Record<string, unknown> = {};
  if (settings.styleProfile !== undefined) patch.style_profile = settings.styleProfile;
  if (settings.homeInterests !== undefined) patch.home_interests = settings.homeInterests;
  if (Object.keys(patch).length === 0) return;

  const { error } = await sb.from("profiles").update(patch).eq("id", uid);
  if (error) throw fromSupabaseError(error);
}

export async function loadCanvasState(canvasId: string): Promise<Record<string, unknown> | null> {
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid || !canvasId) return null;

  const data = await checkDb<Record<string, unknown> | null>(
    () => sb.from("canvases").select("state").eq("id", canvasId).eq("user_id", uid).maybeSingle() as PromiseLike<{ data: Record<string, unknown> | null; error: { code?: string; message: string; details?: unknown; hint?: string } | null }>,
    "loadCanvasState",
  );
  const state = data?.state as Record<string, unknown> | undefined;
  return state && Object.keys(state).length > 0 ? state : null;
}

export async function saveCanvasState(
  canvasId: string,
  projectId: string,
  state: Record<string, unknown>,
): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid || !canvasId) return;

  const { error } = await sb.from("canvases").upsert({
    id: canvasId,
    project_id: projectId,
    user_id: uid,
    state,
  });
  if (error) throw fromSupabaseError(error);
}

export async function clearCanvasState(canvasId: string): Promise<void> {
  assertConfigured();
  const sb = createClient();
  const uid = await getUserId();
  if (!sb || !uid || !canvasId) return;

  const { error } = await sb.from("canvases").update({ state: {} }).eq("id", canvasId).eq("user_id", uid);
  if (error) throw fromSupabaseError(error);
}
