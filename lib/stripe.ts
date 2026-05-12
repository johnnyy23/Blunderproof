import Stripe from "stripe";
import type { BillingCycle, MembershipPlan } from "@/lib/auth";

let stripeClient: Stripe | null = null;

type CheckoutSelection = {
  plan: MembershipPlan;
  billingCycle: BillingCycle;
};

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Stripe is not configured yet. Add STRIPE_SECRET_KEY to your environment.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getStripeAppUrl(origin?: string): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;

  if (explicit) {
    return explicit;
  }

  if (origin) {
    return origin;
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

export function resolvePriceForSelection(selection: CheckoutSelection): { priceId: string; label: string } {
  if (selection.plan === "free") {
    throw new Error("Choose a paid plan before opening checkout.");
  }

  if (selection.plan === "team") {
    const priceId = process.env.STRIPE_PRICE_TEAM;

    if (!priceId) {
      throw new Error("Missing STRIPE_PRICE_TEAM in your environment.");
    }

    return { priceId, label: "Team plan" };
  }

  if (selection.billingCycle === "yearly") {
    const priceId = process.env.STRIPE_PRICE_PRO_YEARLY;

    if (!priceId) {
      throw new Error("Missing STRIPE_PRICE_PRO_YEARLY in your environment.");
    }

    return { priceId, label: "Pro yearly" };
  }

  const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY;

  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_PRO_MONTHLY in your environment.");
  }

  return { priceId, label: "Pro monthly" };
}

export function isFutureUnixTimestamp(dateString: string | null | undefined): number | null {
  if (!dateString) {
    return null;
  }

  const timestamp = Math.floor(new Date(dateString).getTime() / 1000);
  const now = Math.floor(Date.now() / 1000);

  return timestamp > now + 60 ? timestamp : null;
}
