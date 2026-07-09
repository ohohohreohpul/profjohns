/**
 * Voice training (VISION Phase 3, §4.3 pragmatic path).
 *
 * Turns the user's writing corpus into a StyleProfile the Stylist writes from:
 *   1. an LLM pass (`dna` mode) derives a structured voice description, and
 *   2. a few verbatim EXEMPLAR passages are attached so the model has concrete
 *      examples of the voice, not just a description.
 * RAG + exemplars reaches ~80% of "sounds like me" without any embedding
 * index (that — retrieval over a large corpus — is the Phase-5 upgrade).
 *
 * The pure helpers (pickExemplars, composeStyleProfile) are dependency-free
 * and unit-tested; `trainVoice` orchestrates them around the AI call.
 */
import { deriveStyleProfile } from "@/lib/ai-client";
import type { CorpusSample } from "@/store/corpus-store";

const MAX_ANALYSIS_CHARS = 40_000;
const EXEMPLAR_CHARS = 600;
const MAX_EXEMPLARS = 3;

/** Pick representative verbatim excerpts — the longest paragraph from each of
 *  the first `max` samples, trimmed to `chars`. Deterministic (no randomness),
 *  so it's testable and stable across re-trains. */
export function pickExemplars(
  samples: CorpusSample[],
  max: number = MAX_EXEMPLARS,
  chars: number = EXEMPLAR_CHARS,
): string[] {
  const out: string[] = [];
  for (const sample of samples.slice(0, max)) {
    const longest = sample.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .sort((a, b) => b.length - a.length)[0];
    const excerpt = (longest ?? sample.text.trim()).slice(0, chars).trim();
    if (excerpt) out.push(excerpt);
  }
  return out;
}

/** Fold the derived profile + verbatim exemplars into the single StyleProfile
 *  string the `write` mode already consumes as `style` — so no route change is
 *  needed to apply the corpus. */
export function composeStyleProfile(
  profile: string,
  exemplars: string[],
): string {
  const base = profile.trim();
  if (exemplars.length === 0) return base;
  const block = exemplars
    .map((e, i) => `Example ${i + 1}:\n${e}`)
    .join("\n\n");
  return `${base}\n\nEXEMPLAR PASSAGES — mirror this exact voice, rhythm, and diction (do NOT copy their content):\n${block}`;
}

/** Combine the corpus, derive the profile, attach exemplars. Returns the
 *  composed StyleProfile string (store it in workspace.styleProfile). */
export async function trainVoice(samples: CorpusSample[]): Promise<string> {
  const combined = samples
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n\n---\n\n")
    .slice(0, MAX_ANALYSIS_CHARS);
  const profile = await deriveStyleProfile(combined);
  return composeStyleProfile(profile, pickExemplars(samples));
}
