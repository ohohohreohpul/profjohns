import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePlan, getUserSubscription } from "@/lib/stripe/subscription";

/**
 * GET /api/billing/status
 * Returns the authenticated user's effective plan and subscription status.
 * Used by the client-side useSubscription hook.
 */
export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ plan: "free", status: "none" });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ plan: "free", status: "none" });
  }

  const sub = await getUserSubscription();
  const effectivePlan = getEffectivePlan(sub);

  return NextResponse.json({
    plan: effectivePlan.id,
    status: sub?.status ?? "none",
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  });
}