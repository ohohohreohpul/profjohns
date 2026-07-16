import Stripe from "stripe";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/server-auth";
import { canUseLocalMode } from "@/lib/config/env";
import { NextRequest, NextResponse } from "next/server";

/**
 * Stripe Checkout — creates a Checkout Session for a plan purchase.
 *
 * Query params: ?plan=starter|pro|scholar|lifetime
 *
 * Flow:
 *   1. User clicks "Upgrade" in the app
 *   2. This route creates a Stripe Checkout Session
 *   3. User pays on Stripe-hosted page
 *   4. Stripe redirects to /billing?session_id=...
 *   5. Stripe sends webhook to /api/stripe/webhook (grants entitlement)
 */

// Plan → Stripe Price ID mapping (fill in your real price IDs from Stripe Dashboard)
const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? "",
  pro: process.env.STRIPE_PRICE_PRO ?? "",
  scholar: process.env.STRIPE_PRICE_SCHOLAR ?? "",
  lifetime: process.env.STRIPE_PRICE_LIFETIME ?? "",
};

// Credit top-up price IDs
const TOPUP_IDS: Record<string, string> = {
  "5": process.env.STRIPE_PRICE_TOPUP_5 ?? "",
  "10": process.env.STRIPE_PRICE_TOPUP_10 ?? "",
  "25": process.env.STRIPE_PRICE_TOPUP_25 ?? "",
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-06-30.basil" as Stripe.LatestApiVersion });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (canUseLocalMode()) {
    return NextResponse.json({ error: "Billing is not available in local mode." }, { status: 400 });
  }

  let user;
  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const plan = body.plan as string | undefined;
  const topup = body.topup as string | undefined;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured. Please contact support." },
      { status: 500 },
    );
  }

  // Determine the price ID
  let priceId: string | undefined;

  if (topup) {
    priceId = TOPUP_IDS[topup];
    if (!priceId) {
      return NextResponse.json({ error: "Invalid top-up amount." }, { status: 400 });
    }
  } else if (plan) {
    priceId = PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Specify a plan or top-up amount." }, { status: 400 });
  }

  // Check if price ID is configured
  if (!priceId) {
    return NextResponse.json(
      { error: "This plan is not yet available for purchase. Please contact support." },
      { status: 503 },
    );
  }

  const appUrl = process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    // Find or create Stripe customer
    let customerId: string | undefined;

    // Look up existing customer by email
    const existingCustomers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: topup ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/billing?canceled=true`,
      metadata: {
        userId: user.id,
        email: user.email,
        plan: plan ?? "",
        topup: topup ?? "",
      },
      allow_promotion_codes: true,
    });

    // Store customer mapping in our DB
    if (customerId && session.customer) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      if (supabase) {
        await supabase.from("customers").upsert({
          user_id: user.id,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer.id,
          email: user.email,
        }, { onConflict: "user_id" });
      }
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session. Please try again." },
      { status: 500 },
    );
  }
}
