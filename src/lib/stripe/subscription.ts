import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PLANS, type Plan, type PlanId } from "@/lib/stripe/plans";

/**
 * Subscription status as synced from Stripe webhooks.
 * Mirrors Stripe's subscription status values we care about.
 */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "none";

export interface SubscriptionRecord {
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: number | null; // unix seconds
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

/**
 * The effective plan for a user, accounting for grace periods.
 * A subscription that is `active` or `trialing` grants full access.
 * `past_due` keeps access for 3 days (Stripe's default dunning window)
 * so a failed payment doesn't immediately lock users out.
 */
export function getEffectivePlan(sub: SubscriptionRecord | null): Plan {
  if (!sub) return PLANS.free;

  const isGracePeriod = (status: SubscriptionStatus): boolean => {
    if (status === "active" || status === "trialing") return true;
    if (status === "past_due") {
      const graceWindowSeconds = 3 * 24 * 60 * 60; // 3 days
      if (!sub.currentPeriodEnd) return false;
      return Date.now() / 1000 < sub.currentPeriodEnd + graceWindowSeconds;
    }
    return false;
  };

  if (sub.plan === "pro" && isGracePeriod(sub.status)) {
    return PLANS.pro;
  }
  return PLANS.free;
}

/**
 * Read the authenticated user's subscription from Supabase.
 * Uses the server client (respects RLS — user can only read their own row).
 */
export async function getUserSubscription(): Promise<SubscriptionRecord | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("plan,status,current_period_end,stripe_customer_id,stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    plan: data.plan as PlanId,
    status: data.status as SubscriptionStatus,
    currentPeriodEnd: data.current_period_end,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
  };
}

/**
 * Read any user's subscription by ID using the service client (bypasses RLS).
 * Used by webhook handlers and cron jobs that have no user session.
 */
export async function getSubscriptionByUserId(
  userId: string,
): Promise<SubscriptionRecord | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("plan,status,current_period_end,stripe_customer_id,stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    plan: data.plan as PlanId,
    status: data.status as SubscriptionStatus,
    currentPeriodEnd: data.current_period_end,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
  };
}

/**
 * Upsert a subscription row from a webhook event.
 * Uses the service client (no user session during webhooks).
 */
export async function upsertSubscription(
  userId: string,
  record: SubscriptionRecord,
): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) return;

  await supabase
    .from("subscriptions")
    .upsert({
      user_id: userId,
      plan: record.plan,
      status: record.status,
      current_period_end: record.currentPeriodEnd,
      stripe_customer_id: record.stripeCustomerId,
      stripe_subscription_id: record.stripeSubscriptionId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
}