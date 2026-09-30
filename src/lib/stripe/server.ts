import type Stripe from "stripe";

/**
 * Server-only Stripe client. Returns null when the secret key is not
 * configured, so the rest of the app can degrade gracefully (free tier
 * with no billing) rather than crashing at module load.
 *
 * Never import this from client code — the secret key must stay server-side.
 */
let cached: Stripe | null | undefined;

export async function getStripe(): Promise<Stripe | null> {
  if (cached !== undefined) return cached;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    cached = null;
    return null;
  }

  const { default: StripeSDK } = await import("stripe");
  cached = new StripeSDK(secretKey, {
    typescript: true,
  });
  return cached;
}

/** Throws if Stripe is not configured — use in API routes that require it. */
export async function requireStripe(): Promise<Stripe> {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.",
    );
  }
  return stripe;
}