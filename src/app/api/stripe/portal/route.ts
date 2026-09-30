import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { requireStripe } from "@/lib/stripe/server";

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session so the user can manage their
 * subscription (update card, cancel, view invoices).
 *
 * Requires an authenticated user with an existing Stripe customer ID.
 */
export async function POST() {
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
        { error: "You must be signed in to manage your subscription." },
        { status: 401 },
      );
    }

    const stripe = await requireStripe();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const customerId = sub?.stripe_customer_id;
    if (!customerId) {
      return NextResponse.json(
        { error: "No active subscription found. Subscribe first." },
        { status: 404 },
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://profjohns.vercel.app";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create portal session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}