/**
 * Phase 1 persistence — Supabase data access for the workspace.
 *
 * Every function is a no-op (returns null/empty) when Supabase is not
 * configured or the user is signed out, so the localStorage flow is untouched
 * for anonymous use. RLS scopes all rows to auth.uid(); we still stamp user_id
 * on writes to satisfy the insert policies.
 */
import { createClient } from "@/lib/supabase/client";
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

async function userId(): Promise<string | null> {
  const sb = createClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
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

/** Load the signed-in user's agents. Returns null when signed out/unconfigured. */
export async function loadAgents(): Promise<Agent[] | null> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return null;
  const { data } = await sb.from("agents").select("*");
  return (data ?? []).map(agentFromRow);
}

/** Upsert all local agents and delete any DB rows the user removed. */
export async function reconcileAgents(agents: Agent[]): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  if (agents.length) {
    await sb.from("agents").upsert(
      agents.map((a) => ({
        id: a.id,
        user_id: uid,
        name: a.name,
        archetype: a.archetype,
        description: a.description,
        system_prompt: a.systemPrompt,
        model_id: a.modelId,
        built_in: a.builtIn,
        citation_style: a.citationStyle ?? null,
      })),
    );
  }
  const keep = agents.map((a) => a.id);
  const del = sb.from("agents").delete().eq("user_id", uid);
  await (keep.length ? del.not("id", "in", `(${keep.join(",")})`) : del);
}

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
  const uid = await userId();
  if (!sb || !uid) return null;
  const { data } = await sb
    .from("standing_tasks")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map(taskFromRow);
}

export async function saveStandingTask(task: StandingTask): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  await sb.from("standing_tasks").upsert({
    id: task.id,
    user_id: uid,
    project_id: task.projectId ?? null,
    topic: task.topic,
    sources: task.sources,
    agent_id: task.agentId ?? null,
    schedule: task.schedule,
    enabled: task.enabled,
    last_run_at: task.lastRunAt ? new Date(task.lastRunAt).toISOString() : null,
  });
}

export async function deleteStandingTask(id: string): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  await sb.from("standing_tasks").delete().eq("id", id).eq("user_id", uid);
}

/** Findings already recorded for a task — used to dedup a fresh run. */
export async function knownFindingSourceIds(taskId: string): Promise<string[]> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return [];
  const { data } = await sb
    .from("findings")
    .select("source_id")
    .eq("task_id", taskId);
  return (data ?? []).map((r) => String((r as Record<string, unknown>).source_id));
}

export async function loadFindings(): Promise<Finding[] | null> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return null;
  const { data } = await sb
    .from("findings")
    .select("*")
    .order("created_at", { ascending: false });
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

/** Insert findings, ignoring any already recorded for the task (unique
 *  task_id+source_id). Returns the number newly inserted. */
export async function insertFindings(
  taskId: string,
  findings: Array<{ source: PaperSource; score?: number; why?: string }>,
): Promise<number> {
  const sb = createClient();
  const uid = await userId();
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
  const { data } = await sb
    .from("findings")
    .upsert(rows, { onConflict: "task_id,source_id", ignoreDuplicates: true })
    .select("id");
  return data?.length ?? 0;
}

export async function setFindingStatus(id: string, status: FindingStatus): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  await sb.from("findings").update({ status }).eq("id", id).eq("user_id", uid);
}

export interface SemanticHit {
  id: string;
  title: string;
  authors: string;
  year: number | null;
  url: string;
  abstract: string;
  similarity: number;
}

/** Sources for this user that still need an embedding (title + abstract to
 *  embed, so the caller can index them). */
export async function sourcesNeedingIndex(): Promise<
  Array<{ id: string; text: string }>
> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return [];
  const { data } = await sb
    .from("sources")
    .select("id, title, abstract")
    .is("embedding", null)
    .limit(200);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      text: `${String(row.title ?? "")}\n\n${String(row.abstract ?? "")}`.trim(),
    };
  });
}

/** Store a source's embedding vector. */
export async function setSourceEmbedding(
  id: string,
  embedding: number[],
): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  await sb.from("sources").update({ embedding }).eq("id", id).eq("user_id", uid);
}

/** Semantic search over the user's indexed sources via the pgvector RPC. */
export async function semanticSearchSources(
  queryEmbedding: number[],
  matchCount = 10,
): Promise<SemanticHit[]> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return [];
  const { data, error } = await sb.rpc("match_sources", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });
  if (error) return [];
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

export interface FigureHit {
  id: string;
  src: string;
  caption: string;
  similarity: number;
}

/** Store (or update) a figure + its CLIP embedding for search. */
export async function saveFigure(fig: {
  id: string;
  projectId?: string;
  src: string;
  caption?: string;
  embedding: number[];
}): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  await sb.from("figures").upsert({
    id: fig.id,
    user_id: uid,
    project_id: fig.projectId ?? null,
    src: fig.src,
    caption: fig.caption ?? "",
    embedding: fig.embedding,
  });
}

/** Text-to-figure / figure-to-figure search via the CLIP pgvector RPC. */
export async function matchFigures(
  queryEmbedding: number[],
  matchCount = 12,
): Promise<FigureHit[]> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return [];
  const { data, error } = await sb.rpc("match_figures", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    src: String(r.src ?? ""),
    caption: String(r.caption ?? ""),
    similarity: typeof r.similarity === "number" ? r.similarity : 0,
  }));
}

/** Pull the whole workspace for the signed-in user. Returns null when signed out. */
export async function loadWorkspace(): Promise<WorkspaceSnapshot | null> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return null;

  const [projects, canvases, pinned, profile] = await Promise.all([
    sb.from("projects").select("*").order("updated_at", { ascending: false }),
    sb.from("canvases").select("id,project_id,name,item_count,created_at,updated_at"),
    sb.from("pinned_sources").select("project_id, sources(*)"),
    sb.from("profiles").select("style_profile, home_interests").eq("id", uid).maybeSingle(),
  ]);

  const pinnedSources: Record<string, PaperSource[]> = {};
  for (const row of (pinned.data ?? []) as Record<string, unknown>[]) {
    const pid = String(row.project_id);
    const src = (row.sources as Record<string, unknown> | null)?.data as PaperSource | undefined;
    if (!src) continue;
    (pinnedSources[pid] ??= []).push(src);
  }

  return {
    projects: (projects.data ?? []).map(projectFromRow),
    canvases: (canvases.data ?? []).map(canvasFromRow),
    pinnedSources,
    styleProfile: (profile.data?.style_profile as string | null) ?? null,
    homeInterests: (profile.data?.home_interests as HomeInterest[] | null) ?? null,
  };
}

/** Upsert all local projects and delete any DB rows the user removed. */
export async function reconcileProjects(projects: Project[]): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  if (projects.length) {
    await sb.from("projects").upsert(
      projects.map((p) => ({
        id: p.id,
        user_id: uid,
        name: p.name,
        direction: p.direction,
        item_count: p.itemCount ?? 0,
      })),
    );
  }
  const keep = projects.map((p) => p.id);
  const del = sb.from("projects").delete().eq("user_id", uid);
  await (keep.length ? del.not("id", "in", `(${keep.join(",")})`) : del);
}

/** Upsert canvas METADATA only (never the `state` blob — that syncs separately). */
export async function reconcileCanvases(canvases: Canvas[]): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  if (canvases.length) {
    await sb.from("canvases").upsert(
      canvases.map((c) => ({
        id: c.id,
        project_id: c.projectId,
        user_id: uid,
        name: c.name,
        item_count: c.itemCount ?? 0,
      })),
    );
  }
  const keep = canvases.map((c) => c.id);
  const del = sb.from("canvases").delete().eq("user_id", uid);
  await (keep.length ? del.not("id", "in", `(${keep.join(",")})`) : del);
}

/** Reconcile pinned sources: upsert the source records + the project↔source joins. */
export async function reconcilePinned(
  pinnedSources: Record<string, PaperSource[]>,
): Promise<void> {
  const sb = createClient();
  const uid = await userId();
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

  if (all.length) {
    const seen = new Set<string>();
    const rows = all
      .filter((s) => (seen.has(s.id) ? false : seen.add(s.id)))
      .map((s) => ({
        id: s.id,
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
    await sb.from("sources").upsert(rows);
  }

  // Replace this user's joins with the current set.
  await sb.from("pinned_sources").delete().eq("user_id", uid);
  if (joins.length) await sb.from("pinned_sources").upsert(joins);
}

/** Persist account-level settings (Lily voice + Discover interests). */
export async function saveSettings(settings: {
  styleProfile?: string | null;
  homeInterests?: HomeInterest[];
}): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid) return;
  const patch: Record<string, unknown> = {};
  if (settings.styleProfile !== undefined) patch.style_profile = settings.styleProfile;
  if (settings.homeInterests !== undefined) patch.home_interests = settings.homeInterests;
  if (Object.keys(patch).length === 0) return;
  await sb.from("profiles").update(patch).eq("id", uid);
}

/** Load a canvas board's `state` blob (the canvas-store partialized object). */
export async function loadCanvasState(
  canvasId: string,
): Promise<Record<string, unknown> | null> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid || !canvasId) return null;
  const { data } = await sb
    .from("canvases")
    .select("state")
    .eq("id", canvasId)
    .maybeSingle();
  const state = data?.state as Record<string, unknown> | undefined;
  return state && Object.keys(state).length > 0 ? state : null;
}

/** Save a canvas board's `state` blob (upsert; leaves metadata columns intact). */
export async function saveCanvasState(
  canvasId: string,
  projectId: string,
  state: Record<string, unknown>,
): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid || !canvasId) return;
  await sb.from("canvases").upsert({
    id: canvasId,
    project_id: projectId,
    user_id: uid,
    state,
  });
}

/** Wipe a canvas board's stored `state` (recovery for a corrupted board). */
export async function clearCanvasState(canvasId: string): Promise<void> {
  const sb = createClient();
  const uid = await userId();
  if (!sb || !uid || !canvasId) return;
  await sb.from("canvases").update({ state: {} }).eq("id", canvasId);
}
