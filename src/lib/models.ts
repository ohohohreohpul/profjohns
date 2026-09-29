/**
 * Catalog of AI models the canvas can route actions through. Each model maps to
 * a real OpenRouter model id (`openrouterId`) so the picker is truthful: the
 * model the user selects is the model that runs. `creditsPerRun` is an
 * illustrative cost hint shown in the picker; values are mock figures for the
 * prototype.
 */

export type ModelProvider = "anthropic" | "google" | "openai";

export type ModelTier = "fast" | "balanced" | "frontier";

export interface AiModel {
  id: string;
  label: string;
  provider: ModelProvider;
  tier: ModelTier;
  /** Real OpenRouter model id — sent to /api/ai when this model is selected. */
  openrouterId: string;
  /** Illustrative credit cost per action run. */
  creditsPerRun: number;
  /** One-line description shown in the picker. */
  blurb: string;
}

export const PROVIDER_LABEL: Record<ModelProvider, string> = {
  anthropic: "Claude",
  google: "Gemini",
  openai: "OpenAI",
};

export const TIER_LABEL: Record<ModelTier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  frontier: "Frontier",
};

export const MODELS: AiModel[] = [
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    provider: "anthropic",
    tier: "frontier",
    openrouterId: "anthropic/claude-opus-4",
    creditsPerRun: 14,
    blurb: "Deepest reasoning. Best for synthesis and critical review.",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    tier: "balanced",
    openrouterId: "anthropic/claude-sonnet-4",
    creditsPerRun: 5,
    blurb: "Strong all-rounder for extraction and drafting.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    tier: "fast",
    openrouterId: "anthropic/claude-haiku-4.5",
    creditsPerRun: 1,
    blurb: "Fast, cheap. Good for quick reads and tagging.",
  },
  {
    id: "gemini-2-5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    tier: "frontier",
    openrouterId: "google/gemini-2.5-pro",
    creditsPerRun: 11,
    blurb: "Long-context retrieval across large source sets.",
  },
  {
    id: "gemini-2-5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    tier: "fast",
    openrouterId: "google/gemini-2.5-flash",
    creditsPerRun: 2,
    blurb: "High-throughput scanning of many papers at once.",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    provider: "openai",
    tier: "frontier",
    openrouterId: "openai/gpt-5",
    creditsPerRun: 12,
    blurb: "Versatile reasoning for writing and counter-arguments.",
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

/** Map a catalog model id to its OpenRouter id, or undefined when unknown. */
export function openrouterIdFor(modelId: string | undefined): string | undefined {
  if (!modelId) return undefined;
  return MODELS.find((m) => m.id === modelId)?.openrouterId;
}

export function getModel(id: string): AiModel {
  const found = MODELS.find((m) => m.id === id);
  if (!found) {
    throw new Error(`Unknown model id: ${id}`);
  }
  return found;
}