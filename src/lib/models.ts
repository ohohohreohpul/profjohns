/**
 * Catalog of AI models the canvas can route actions through.
 * `creditsPerRun` is an illustrative cost hint shown in the model picker.
 * Values are mock figures for the prototype.
 */

export type ModelProvider = "anthropic" | "google" | "openai";

export type ModelTier = "fast" | "balanced" | "frontier";

export interface AiModel {
  id: string;
  label: string;
  provider: ModelProvider;
  tier: ModelTier;
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
    creditsPerRun: 14,
    blurb: "Deepest reasoning. Best for synthesis and critical review.",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    tier: "balanced",
    creditsPerRun: 5,
    blurb: "Strong all-rounder for extraction and drafting.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    tier: "fast",
    creditsPerRun: 1,
    blurb: "Fast, cheap. Good for quick reads and tagging.",
  },
  {
    id: "gemini-2-5-pro",
    label: "Gemini 2.5 Pro",
    provider: "google",
    tier: "frontier",
    creditsPerRun: 11,
    blurb: "Long-context retrieval across large source sets.",
  },
  {
    id: "gemini-2-5-flash",
    label: "Gemini 2.5 Flash",
    provider: "google",
    tier: "fast",
    creditsPerRun: 2,
    blurb: "High-throughput scanning of many papers at once.",
  },
  {
    id: "gpt-5",
    label: "GPT-5",
    provider: "openai",
    tier: "frontier",
    creditsPerRun: 12,
    blurb: "Versatile reasoning for writing and counter-arguments.",
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

export function getModel(id: string): AiModel {
  const found = MODELS.find((m) => m.id === id);
  if (!found) {
    throw new Error(`Unknown model id: ${id}`);
  }
  return found;
}
