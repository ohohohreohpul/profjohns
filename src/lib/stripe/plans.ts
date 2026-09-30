/**
 * Subscription plan definitions — the single source of truth for pricing,
 * feature limits, and Stripe price IDs. Both the pricing page (client) and
 * the checkout API (server) import from here.
 *
 * Price IDs are read from env vars so they can be swapped per environment
 * (test vs live Stripe keys) without a code change.
 */

export type PlanId = "free" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  description: string;
  features: string[];
  /** Stripe Price ID (price_...) — null for the free plan. */
  stripePriceId: string | null;
  /** Max projects a user on this plan can create. */
  maxProjects: number;
  /** Whether AI research features are available. */
  aiEnabled: boolean;
  /** Whether all source providers (Semantic Scholar, PDF, etc.) are available. */
  allSources: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    description: "Explore the research feed and try the canvas.",
    features: [
      "Browse the Discover feed",
      "1 research project",
      "Basic AI search (OpenAlex + arXiv)",
      "Node-based canvas editor",
    ],
    stripePriceId: null,
    maxProjects: 1,
    aiEnabled: true,
    allSources: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 19,
    description: "For researchers who need the full toolkit.",
    features: [
      "Everything in Free",
      "Unlimited research projects",
      "Full AI research agent (all source providers)",
      "Standing watch tasks (work while you sleep)",
      "Semantic search across your library",
      "Priority support",
    ],
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
    maxProjects: Infinity,
    aiEnabled: true,
    allSources: true,
  },
};

export const PLAN_LIST: Plan[] = [PLANS.free, PLANS.pro];

/** Resolve a Stripe price ID to a plan, or null if it doesn't match. */
export function planFromPriceId(priceId: string): Plan | null {
  for (const plan of PLAN_LIST) {
    if (plan.stripePriceId && plan.stripePriceId === priceId) return plan;
  }
  return null;
}