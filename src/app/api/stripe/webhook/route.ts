import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Disable body parsing — we need the raw body for Stripe signature verification.
export const dynamic = "force-dynamic";
import { requireStripe } from "@/lib/stripe/server";
import { planFromPriceId } from "@/lib/stripe/plans";
import {
  upsertSubscription,
  getSubscriptionByUserId,
} from "@/lib/stripe/subscription";
import type { SubscriptionRecord } from "@/lib/stripe/subscription";
import type Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 * Receives Stripe webhook events and syncs subscription state to Supabase.
 *
 * Handled events:
 * - checkout.session.completed      → activate subscription
 * - customer.subscription.updated   → update status / period
 * - customer.subscription.deleted   → mark canceled
 * - invoice.payment_failed          → mark past_due
 *
 * The raw body must be passed to constructEvent — Next.js Route Handlers
 * give us the body as a stream, so we read it with await req.text().
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 500 },
    );
  }

  const stripe = await requireStripe();

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(stripe, event);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        await handleSubscriptionUpdated(event);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event);
        break;
      }
      case "invoice.payment_failed": {
        await handlePaymentFailed(event);
        break;
      }
      default:
        // Unhandled event types are expected — Stripe sends many we don't use.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely extract a string ID from a Stripe expandable field (string | object). */
function idFromExpandable(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: string }).id);
  }
  return null;
}

/** Extract supabaseUserId from event metadata or client_reference_id. */
function getUserIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;
  const metadata = (obj.metadata ?? {}) as Record<string, string>;
  const clientRefId = obj.client_reference_id as string | undefined;
  return metadata.supabaseUserId ?? clientRefId ?? null;
}

/** Get current_period_end from a subscription (lives on the item in API v2324). */
function getPeriodEnd(subscription: Stripe.Subscription): number | null {
  const firstItem = subscription.items.data[0];
  return firstItem?.current_period_end ?? null;
}

/** Get the customer ID from a subscription as a string. */
function getCustomerId(subscription: Stripe.Subscription): string | null {
  return idFromExpandable(subscription.customer);
}

/** Get the subscription ID from an invoice (nested in parent in API v2324). */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // API v2324: invoice.parent.subscription_details.subscription
  const subDetails = invoice.parent?.subscription_details;
  if (subDetails) {
    return idFromExpandable(subDetails.subscription);
  }
  // Fallback for older API versions where invoice.subscription exists.
  return idFromExpandable(
    (invoice as unknown as Record<string, unknown>).subscription,
  );
}

/** Resolve a Stripe customer ID to a supabase user ID via customer metadata. */
async function resolveUserIdByCustomer(
  stripe: Stripe,
  customerId: string,
): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer && !("deleted" in customer)) {
    const meta = customer.metadata ?? {};
    if (meta.supabaseUserId) return meta.supabaseUserId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  let userId = getUserIdFromEvent(event);
  const customerId = idFromExpandable(session.customer);

  if (!userId && customerId) {
    userId = await resolveUserIdByCustomer(stripe, customerId);
  }
  if (!userId) return;

  const subscriptionId = idFromExpandable(session.subscription);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const record = buildSubscriptionRecord(subscription);

  await upsertSubscription(userId, record);
}

async function handleSubscriptionUpdated(
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const userId = getUserIdFromEvent(event);
  if (!userId) return;

  const record = buildSubscriptionRecord(subscription);
  await upsertSubscription(userId, record);
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const userId = getUserIdFromEvent(event);
  if (!userId) return;

  const record: SubscriptionRecord = {
    plan: "free",
    status: "canceled",
    currentPeriodEnd: getPeriodEnd(subscription),
    stripeCustomerId: getCustomerId(subscription),
    stripeSubscriptionId: subscription.id,
  };
  await upsertSubscription(userId, record);
}

async function handlePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  // Find the user by their stripe_subscription_id.
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = createServiceClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!data?.user_id) return;

  const existing = await getSubscriptionByUserId(data.user_id);
  if (!existing) return;

  await upsertSubscription(data.user_id, {
    ...existing,
    status: "past_due",
  });
}

/** Build a SubscriptionRecord from a Stripe Subscription object. */
function buildSubscriptionRecord(
  subscription: Stripe.Subscription,
): SubscriptionRecord {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const plan = priceId ? planFromPriceId(priceId) : null;

  return {
    plan: plan?.id ?? "free",
    status: subscription.status as SubscriptionRecord["status"],
    currentPeriodEnd: getPeriodEnd(subscription),
    stripeCustomerId: getCustomerId(subscription),
    stripeSubscriptionId: subscription.id,
  };
}