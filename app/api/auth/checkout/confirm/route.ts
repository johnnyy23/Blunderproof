import { NextRequest, NextResponse } from "next/server";
import { updateStripeCheckoutForUser, type BillingCycle, type MembershipPlan } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    const sessionId = body.sessionId?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: "Missing checkout session ID." }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"]
    });

    const appUserId = session.metadata?.appUserId || session.client_reference_id;

    if (!appUserId) {
      return NextResponse.json({ error: "Checkout session is missing app user metadata." }, { status: 400 });
    }

    const subscription = typeof session.subscription === "object" && session.subscription ? session.subscription : null;
    const plan = (session.metadata?.plan as MembershipPlan | undefined) ?? "pro";
    const billingCycle = (session.metadata?.billingCycle as BillingCycle | undefined) ?? "monthly";
    const subscriptionStatus = subscription?.status ?? null;
    const isTrialing = subscriptionStatus === "trialing";
    const isActive = subscriptionStatus === "active";

    const user = await updateStripeCheckoutForUser(appUserId, {
      membershipPlan: plan,
      billingCycle,
      billingEmail: session.customer_details?.email ?? undefined,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId: subscription?.id ?? null,
      billingState: isTrialing ? "trial" : isActive ? "active" : "checkout_pending",
      membershipStatus: isTrialing ? "trialing" : "active",
      billingStartedAt: new Date().toISOString()
    });

    return NextResponse.json({
      ok: true,
      user,
      subscriptionStatus
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not confirm checkout." },
      { status: 400 }
    );
  }
}
