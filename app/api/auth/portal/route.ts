import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserFromSessionToken, sessionCookieName } from "@/lib/auth";
import { getStripe, getStripeAppUrl } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const token = cookies().get(sessionCookieName)?.value;
    const user = await getUserFromSessionToken(token);

    if (!user) {
      return NextResponse.json({ error: "Sign in first to manage billing." }, { status: 401 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer on file yet." }, { status: 400 });
    }

    const stripe = getStripe();
    const appUrl = getStripeAppUrl(new URL(request.url).origin);

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/?portal=return`
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create customer portal session." },
      { status: 400 }
    );
  }
}
