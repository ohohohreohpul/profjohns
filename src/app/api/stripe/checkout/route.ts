import { NextResponse } from "next/server";

// Stripe SDK requires the Node.js runtime (not Edge).
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { requireStripe } from "@/lib/stripe/server";
import { PLANS } from "@/lib/stripe/plans";
import { upsertSubscription } from "@/lib/stripe/subscription";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for the Pro plan.
 * Body: { priceId?: string } — defaults to the Pro monthly price from env.
 *
 * Flow:
 * 1. Authenticate the user via Supabase session.
 * 2. Create or reuse the Stripe customer.
 * 3. Create a Checkout Session (subscription mode).
 * 4. Return the URL for client-side redirect.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to subscribe." },
        { status: 401 },
      );
    }

    const stripe = await requireStripe();

    // Allow override via body, default to the env-configured Pro price.
    const body = await req.json().catch(() => ({}));
    const priceId =
      (body.priceId as string | undefined) ?? PLANS.pro.stripePriceId;

    if (!priceId) {
      return NextResponse.json(
        {
          error:
            "Pro plan is not configured. Set STRIPE_PRICE_PRO_MONTHLY in your environment.",
        },
        { status: 500 },
      );
    }

    // Check if the user already has a Stripe customer ID.
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id ?? null;

    // Create a customer if one doesn't exist yet.
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabaseUserId: user.id },
      });
      customerId = customer.id;

      // Store the customer ID immediately so we can match webhooks.
      await upsertSubscription(user.id, {
        plan: "free",
        status: "none",
        currentPeriodEnd: null,
        stripeCustomerId: customerId,
        stripeSubscriptionId: null,
      });
    }

    const origin = req.headers.get("origin") ?? "https://profjohns.vercel.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?status=success`,
      cancel_url: `${origin}/pricing?status=cancelled`,
      client_reference_id: user.id,
      metadata: { supabaseUserId: user.id },
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { supabaseUserId: user.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create checkout session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}