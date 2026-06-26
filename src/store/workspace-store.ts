import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clearStoredCanvas } from "./canvas-store";
import type { PaperSource } from "@/lib/mock";

/** A Discover interest tab — a keyless OpenAlex query for recent work. */
export interface HomeInterest {
  label: string;
  q: string;
}

export interface Project {
  id: string;
  name: string;
  direction: string;
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
}

/** A single board within a project — canvas is one way of working on the paper. */
export interface Canvas {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  itemCount?: number;
}

interface WorkspaceState {
  projects: Project[];
  canvases: Canvas[];
  hasHydrated: boolean;

  /** Home portal layout: hidden screen ids + explicit order (screen ids). */
  homeHidden: string[];
  homeOrder: string[];
  /** Discover interest tabs — user-editable, persisted. */
  homeInterests: HomeInterest[];
  /** Sources pinned to a project from the Discover feed ("Save to Space"). */
  pinnedSources: Record<string, PaperSource[]>;
  /** Lily's learned writing-voice profile (account-level), or null if untrained. */
  styleProfile: string | null;

  addProject: (name: string, direction: string) => string;
  removeProject: (id: string) => void;
  updateProject: (id: string, partial: Partial<Project>) => void;

  addCanvas: (projectId: string, name?: string) => string;
  removeCanvas: (id: string) => void;
  renameCanvas: (id: string, name: string) => void;
  updateCanvas: (id: string, partial: Partial<Canvas>) => void;

  toggleHomeScreen: (id: string) => void;
  setHomeOrder: (ids: string[]) => void;
  addHomeInterest: (label: string, q: string) => void;
  removeHomeInterest: (label: string) => void;
  pinSource: (projectId: string, source: PaperSource) => void;
  unpinSource: (projectId: string, sourceId: string) => void;
  /** Set or clear Lily's learned voice profile. */
  setStyleProfile: (profile: string | null) => void;
  /** Remove canvases whose project no longer exists + dangling/legacy board keys. */
  pruneOrphans: () => void;
}

let nextProjectId = Date.now();
let nextCanvasId = Date.now() + 1;

const DEFAULT_INTERESTS: HomeInterest[] = [
  { label: "AI & CS", q: "artificial intelligence" },
  { label: "Medicine", q: "clinical medicine" },
  { label: "Neuroscience", q: "neuroscience" },
  { label: "Climate", q: "climate change" },
  { label: "Economics", q: "economics" },
  { label: "Physics", q: "physics" },
];

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      projects: [],
      canvases: [],
      homeHidden: [],
      homeOrder: [],
      homeInterests: DEFAULT_INTERESTS,
      pinnedSources: {},
      styleProfile: null,
      hasHydrated: false,

      addProject: (name, direction) => {
        const id = `proj-${nextProjectId++}`;
        const now = Date.now();
        set((s) => ({
          projects: [
            ...s.projects,
            { id, name, direction, createdAt: now, updatedAt: now },
          ],
        }));
        return id;
      },

      removeProject: (id) =>
        set((s) => {
          // Drop the project's canvases (and their stored boards) too.
          s.canvases
            .filter((c) => c.projectId === id)
            .forEach((c) => clearStoredCanvas(c.id));
          // Clean up pinned sources for this project.
          const pinnedSources = { ...s.pinnedSources };
          delete pinnedSources[id];
          return {
            projects: s.projects.filter((p) => p.id !== id),
            canvases: s.canvases.filter((c) => c.projectId !== id),
            pinnedSources,
          };
        }),

      updateProject: (id, partial) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...partial, updatedAt: Date.now() } : p,
          ),
        })),

      addCanvas: (projectId, name) => {
        const id = `cv-${nextCanvasId++}`;
        const now = Date.now();
        const count = get().canvases.filter((c) => c.projectId === projectId).length;
        set((s) => ({
          canvases: [
            ...s.canvases,
            {
              id,
              projectId,
              name: name?.trim() || `Canvas ${count + 1}`,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },

      removeCanvas: (id) => {
        clearStoredCanvas(id);
        set((s) => ({ canvases: s.canvases.filter((c) => c.id !== id) }));
      },

      renameCanvas: (id, name) =>
        set((s) => ({
          canvases: s.canvases.map((c) =>
            c.id === id ? { ...c, name, updatedAt: Date.now() } : c,
          ),
        })),

      updateCanvas: (id, partial) =>
        set((s) => ({
          canvases: s.canvases.map((c) =>
            c.id === id ? { ...c, ...partial, updatedAt: Date.now() } : c,
          ),
        })),

      toggleHomeScreen: (id) =>
        set((s) => ({
          homeHidden: s.homeHidden.includes(id)
            ? s.homeHidden.filter((h) => h !== id)
            : [...s.homeHidden, id],
        })),

      setHomeOrder: (ids) => set({ homeOrder: ids }),

      addHomeInterest: (label, q) => {
        const cleanLabel = label.trim();
        const cleanQ = q.trim();
        if (!cleanLabel || !cleanQ) return;
        set((s) => {
          // Avoid duplicate labels.
          if (s.homeInterests.some((it) => it.label.toLowerCase() === cleanLabel.toLowerCase())) {
            return s;
          }
          return { homeInterests: [...s.homeInterests, { label: cleanLabel, q: cleanQ }] };
        });
      },

      removeHomeInterest: (label) =>
        set((s) => ({
          homeInterests: s.homeInterests.filter((it) => it.label !== label),
        })),

      pinSource: (projectId, source) =>
        set((s) => {
          const existing = s.pinnedSources[projectId] ?? [];
          if (existing.some((p) => p.id === source.id)) return s;
          return {
            pinnedSources: {
              ...s.pinnedSources,
              [projectId]: [...existing, source],
            },
          };
        }),

      unpinSource: (projectId, sourceId) =>
        set((s) => {
          const existing = s.pinnedSources[projectId] ?? [];
          if (existing.length === 0) return s;
          return {
            pinnedSources: {
              ...s.pinnedSources,
              [projectId]: existing.filter((p) => p.id !== sourceId),
            },
          };
        }),

      setStyleProfile: (profile) => set({ styleProfile: profile }),

      pruneOrphans: () =>
        set((s) => {
          const projectIds = new Set(s.projects.map((p) => p.id));
          const kept = s.canvases.filter((c) => projectIds.has(c.projectId));
          const keptIds = new Set(kept.map((c) => c.id));
          // Clean up pinned sources for deleted projects.
          const pinnedSources: Record<string, PaperSource[]> = {};
          for (const [pid, list] of Object.entries(s.pinnedSources)) {
            if (projectIds.has(pid)) pinnedSources[pid] = list;
          }
          if (typeof localStorage !== "undefined") {
            // Legacy non-namespaced board (pre per-canvas storage).
            localStorage.removeItem("lattice-canvas-v1");
            // Dangling per-canvas boards with no surviving canvas entry.
            for (const k of Object.keys(localStorage)) {
              if (!k.startsWith("lattice-canvas-v1::")) continue;
              const id = k.slice("lattice-canvas-v1::".length);
              if (!keptIds.has(id)) localStorage.removeItem(k);
            }
          }
          const changed =
            kept.length !== s.canvases.length ||
            Object.keys(pinnedSources).length !== Object.keys(s.pinnedSources).length;
          return changed ? { canvases: kept, pinnedSources } : s;
        }),
    }),
    {
      name: "lattice-workspace",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        projects: s.projects,
        canvases: s.canvases,
        homeHidden: s.homeHidden,
        homeOrder: s.homeOrder,
        homeInterests: s.homeInterests,
        pinnedSources: s.pinnedSources,
        styleProfile: s.styleProfile,
      }),
      onRehydrateStorage: () => () => {
        useWorkspaceStore.setState({ hasHydrated: true });
      },
    },
  ),
);