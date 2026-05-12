import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  getUserFromSessionToken,
  sessionCookieName,
updateStripeCheckoutForUser,
  type BillingCycle,
  type MembershipPlan
} from "@/lib/auth";
import { getStripe, getStripeAppUrl, isFutureUnixTimestamp, resolvePriceForSelection } from "@/lib/stripe";

type CheckoutBody = {
  plan?: MembershipPlan;
  billingEmail?: string;
  billingCycle?: BillingCycle | null;
};

export async function POST(request: NextRequest) {
  try {
    const token = cookies().get(sessionCookieName)?.value;
    const currentUser = await getUserFromSessionToken(token);

    if (!currentUser) {
      return NextResponse.json({ error: "Sign in first to continue to checkout." }, { status: 401 });
    }

    const body = (await request.json()) as CheckoutBody;
    const selectedPlan = body.plan ?? currentUser.membershipPlan;
    const selectedCycle = body.billingCycle ?? currentUser.billingCycle ?? (selectedPlan === "team" ? "team" : "monthly");
    const billingEmail = body.billingEmail?.trim() || currentUser.billingEmail || currentUser.email;

    if (selectedPlan === "free") {
      return NextResponse.json({ error: "Choose a paid plan before opening checkout." }, { status: 400 });
    }    const stripe = getStripe();
    const { priceId, label } = resolvePriceForSelection({
      plan: selectedPlan,
      billingCycle: selectedCycle
    });

    let stripeCustomerId = currentUser.stripeCustomerId;

    if (stripeCustomerId) {
      await stripe.customers.update(stripeCustomerId, {
        email: billingEmail,
        name: currentUser.name,
        metadata: {
          appUserId: currentUser.id,
          plan: selectedPlan,
          billingCycle: selectedCycle,
          affiliateId: currentUser.affiliateId ?? "",
          referralCode: currentUser.referralCode ?? ""
        }
      });
    } else {
      const customer = await stripe.customers.create({
        email: billingEmail,
        name: currentUser.name,
        metadata: {
          appUserId: currentUser.id,
          plan: selectedPlan,
          billingCycle: selectedCycle,
          affiliateId: currentUser.affiliateId ?? "",
          referralCode: currentUser.referralCode ?? ""
        }
      });
      stripeCustomerId = customer.id;
    }

    await updateStripeCheckoutForUser(currentUser.id, {
      membershipPlan: selectedPlan,
      billingCycle: selectedCycle,
      billingEmail,
      billingState: "checkout_pending",
      stripeCustomerId
    });

    const appUrl = getStripeAppUrl(request.nextUrl.origin);
    const trialEnd = isFutureUnixTimestamp(currentUser.trialEndsAt);

    const session = await stripe.checkout.sessions.create({
      payment_method_collection: "always",
      mode: "subscription",
      success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?checkout=cancel`,
      customer: stripeCustomerId,
      client_reference_id: currentUser.id,
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        appUserId: currentUser.id,
        plan: selectedPlan,
        billingCycle: selectedCycle,
        affiliateId: currentUser.affiliateId ?? "",
        referralCode: currentUser.referralCode ?? ""
      },
      subscription_data: {
        metadata: {
          appUserId: currentUser.id,
          plan: selectedPlan,
          billingCycle: selectedCycle,
          affiliateId: currentUser.affiliateId ?? "",
          referralCode: currentUser.referralCode ?? ""
        },
        ...(trialEnd ? { trial_end: trialEnd } : { trial_period_days: 7 })
      }
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      billingState: "checkout_pending",
      plan: selectedPlan,
      billingCycle: selectedCycle,
      productLabel: label
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create Stripe checkout session." },
      { status: 400 }
    );
  }
}
