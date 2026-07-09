"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * The user's writing corpus (VISION Phase 3 — Personalization). A collection
 * of their own past writing that the Stylist is trained on. localStorage-
 * persisted; the derived StyleProfile lives in the workspace store (and syncs
 * to Supabase). Corpus DB sync is a follow-up — the samples are the user's
 * unpublished writing, so treat storage/isolation as sensitive later.
 */

export interface CorpusSample {
  id: string;
  name: string;
  text: string;
  addedAt: number;
}

function newSampleId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `sample-${uuid}`;
}

interface CorpusState {
  samples: CorpusSample[];
  hasHydrated: boolean;
  addSample: (name: string, text: string) => string;
  removeSample: (id: string) => void;
  clear: () => void;
}

export const useCorpusStore = create<CorpusState>()(
  persist(
    (set) => ({
      samples: [],
      hasHydrated: false,
      addSample: (name, text) => {
        const id = newSampleId();
        set((s) => ({
          samples: [
            ...s.samples,
            { id, name: name.trim() || "Untitled sample", text: text.trim(), addedAt: Date.now() },
          ],
        }));
        return id;
      },
      removeSample: (id) =>
        set((s) => ({ samples: s.samples.filter((x) => x.id !== id) })),
      clear: () => set({ samples: [] }),
    }),
    {
      name: "lattice-corpus",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ samples: s.samples }),
      onRehydrateStorage: () => () => {
        useCorpusStore.setState({ hasHydrated: true });
      },
    },
  ),
);
