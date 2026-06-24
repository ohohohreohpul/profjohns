import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PaperSource } from "@/lib/mock";

/**
 * "For You" interest profile — derived locally from the user's kept sources,
 * project directions, and draft text. No AI calls. The profile is a weighted
 * tally of OpenAlex concept ids + keywords, used to query OpenAlex by concept
 * for the "For You" Discover tab.
 *
 * Kept in its own store (not workspace-store) so the profile stays lean and
 * the eventual VISION-P1 server migration is a clean 1:1 move to its own
 * table/endpoint.
 */

export interface WeightedTerm {
  term: string;
  weight: number;
}
export interface WeightedConcept {
  id: string;
  name: string;
  weight: number;
}

export interface InterestProfile {
  keywords: WeightedTerm[];
  conceptIds: WeightedConcept[];
  updatedAt: number;
}

/** Per-card feedback signal (A3) — persisted so it survives reloads. */
export interface FeedbackEntry {
  paperId: string;
  signal: "more" | "less";
  /** Concept ids + keywords to nudge, snapshotted at feedback time. */
  concepts: { id: string; name: string }[];
  keywords: string[];
  at: number;
}

interface ProfileState {
  profile: InterestProfile;
  /** Explicit feedback that reweights the profile (A3). */
  feedback: FeedbackEntry[];
  hasHydrated: boolean;

  setProfile: (profile: InterestProfile) => void;
  addFeedback: (entry: FeedbackEntry) => void;
  clearFeedback: () => void;
  reset: () => void;
}

const EMPTY_PROFILE: InterestProfile = {
  keywords: [],
  conceptIds: [],
  updatedAt: 0,
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: EMPTY_PROFILE,
      feedback: [],
      hasHydrated: false,

      setProfile: (profile) => set({ profile }),
      addFeedback: (entry) =>
        set((s) => ({
          // Keep feedback bounded — drop the oldest beyond 200 entries.
          feedback: [...s.feedback, entry].slice(-200),
        })),
      clearFeedback: () => set({ feedback: [] }),
      reset: () => set({ profile: EMPTY_PROFILE, feedback: [] }),
    }),
    {
      name: "lattice-profile",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ profile: s.profile, feedback: s.feedback }),
      onRehydrateStorage: () => () => {
        useProfileStore.setState({ hasHydrated: true });
      },
    },
  ),
);

// --- Profile derivation (pure) ---------------------------------------------

/** Tokenize a title/topic/venue into lowercase keyword tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "their",
  "these", "those", "which", "what", "when", "where", "study", "research",
  "analysis", "based", "using", "through", "between", "among", "results",
  "show", "shown", "paper", "article", "review", "approach", "method",
]);

interface ProfileInput {
  sources: PaperSource[];
  directions: string[];
  topics: string[];
}

/** Build a weighted interest profile from local signals — no AI.
 *  Weighting: frequency × recency. Concepts come from OpenAlex `concepts[]`
 *  captured at keep-time; keywords come from titles, venues, and topics. */
export function buildInterestProfile(input: ProfileInput): InterestProfile {
  const conceptCounts = new Map<string, { name: string; count: number }>();
  const keywordCounts = new Map<string, number>();

  const bumpConcept = (id: string, name: string) => {
    const existing = conceptCounts.get(id);
    if (existing) existing.count += 1;
    else conceptCounts.set(id, { name, count: 1 });
  };
  const bumpKeyword = (term: string, n = 1) => {
    keywordCounts.set(term, (keywordCounts.get(term) ?? 0) + n);
  };

  // Kept sources — concepts carry more signal than keywords.
  for (const s of input.sources) {
    for (const c of s.concepts ?? []) bumpConcept(c.id, c.name);
    for (const t of tokenize(s.title)) bumpKeyword(t, 1);
    if (s.venue && s.venue !== "OpenAlex") {
      for (const t of tokenize(s.venue)) bumpKeyword(t, 0.5);
    }
  }

  // Project directions + scout topics — keywords only, lighter weight.
  for (const d of input.directions) {
    for (const t of tokenize(d)) bumpKeyword(t, 1.5);
  }
  for (const topic of input.topics) {
    for (const t of tokenize(topic)) bumpKeyword(t, 1);
  }

  const conceptIds = [...conceptCounts.entries()]
    .map(([id, { name, count }]) => ({ id, name, weight: count }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 25);

  const keywords = [...keywordCounts.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40);

  return {
    conceptIds,
    keywords,
    updatedAt: Date.now(),
  };
}

/** Apply feedback entries to a base profile, producing a reweighted one.
 *  "more" boosts the matching concepts/keywords; "less" suppresses them. */
export function applyFeedback(
  base: InterestProfile,
  feedback: FeedbackEntry[],
): InterestProfile {
  if (feedback.length === 0) return base;

  const conceptWeight = new Map(base.conceptIds.map((c) => [c.id, c.weight]));
  const conceptName = new Map(base.conceptIds.map((c) => [c.id, c.name]));
  const keywordWeight = new Map(base.keywords.map((k) => [k.term, k.weight]));

  for (const f of feedback) {
    const delta = f.signal === "more" ? 1.5 : -1.5;
    for (const c of f.concepts) {
      conceptWeight.set(c.id, (conceptWeight.get(c.id) ?? 0) + delta);
      if (!conceptName.has(c.id)) conceptName.set(c.id, c.name);
    }
    for (const k of f.keywords) {
      keywordWeight.set(k, (keywordWeight.get(k) ?? 0) + delta * 0.5);
    }
  }

  const conceptIds = [...conceptWeight.entries()]
    .map(([id, weight]) => ({ id, name: conceptName.get(id) ?? "", weight }))
    .filter((c) => c.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 25);

  const keywords = [...keywordWeight.entries()]
    .map(([term, weight]) => ({ term, weight }))
    .filter((k) => k.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40);

  return { conceptIds, keywords, updatedAt: base.updatedAt };
}

/** True when the profile has enough signal to drive a "For You" query. */
export function profileHasSignal(profile: InterestProfile): boolean {
  return profile.conceptIds.length >= 2 || profile.keywords.length >= 3;
}
