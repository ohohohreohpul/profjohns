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
