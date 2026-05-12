import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { applyStripeSubscriptionSnapshot } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const payload = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as any;
      const appUserId = subscription?.metadata?.appUserId as string | undefined;

      if (!appUserId) {
        return NextResponse.json({ ok: true });
      }

      const snapshot = {
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
        stripeSubscriptionId: typeof subscription.id === "string" ? subscription.id : null,
        subscriptionStatus: typeof subscription.status === "string" ? subscription.status : null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        trialEndUnix: typeof subscription.trial_end === "number" ? subscription.trial_end : null,
        currentPeriodEndUnix: typeof subscription.current_period_end === "number" ? subscription.current_period_end : null,
        membershipPlan: (subscription.metadata?.plan as any) ?? "pro",
        billingCycle: (subscription.metadata?.billingCycle as any) ?? "monthly",
        billingEmail: null
      } as const;

      await applyStripeSubscriptionSnapshot(appUserId, snapshot);

      // Mirror billing state into Supabase for production safety / future expansion.
      try {
        await supabaseAdmin
          .from("user_billing")
          .upsert(
            {
              app_user_id: appUserId,
              stripe_customer_id: snapshot.stripeCustomerId,
              stripe_subscription_id: snapshot.stripeSubscriptionId,
              subscription_status: snapshot.subscriptionStatus,
              cancel_at_period_end: snapshot.cancelAtPeriodEnd,
              trial_end: snapshot.trialEndUnix ? new Date(snapshot.trialEndUnix * 1000).toISOString() : null,
              current_period_end: snapshot.currentPeriodEndUnix ? new Date(snapshot.currentPeriodEndUnix * 1000).toISOString() : null,
              updated_at: new Date().toISOString()
            },
            { onConflict: "app_user_id" }
          );
      } catch {
        // Non-fatal: local auth store remains the source for app behavior today.
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook handler failed" }, { status: 500 });
  }
}
