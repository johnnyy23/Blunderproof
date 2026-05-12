import Stripe from "stripe";
import type { BillingCycle, MembershipPlan } from "@/lib/auth";

let stripeClient: Stripe | null = null;

type CheckoutSelection = {
  plan: MembershipPlan;
  billingCycle: BillingCycle;
};

export function getStripe(): Stripe {
  const rawSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!rawSecretKey) {
    throw new Error("Stripe is not configured yet. Add STRIPE_SECRET_KEY to your environment.");
  }

  const secretKey = rawSecretKey.trim();

  if (secretKey !== rawSecretKey) {
    throw new Error("STRIPE_SECRET_KEY has leading/trailing whitespace. Re-save it without spaces.");
  }

  if (secretKey.includes("*")) {
    throw new Error(
      "STRIPE_SECRET_KEY looks masked (contains '*'). In Stripe Dashboard (Test mode) go to Developers → API keys, click Reveal test key, then copy the full Secret key."
    );
  }

  if (secretKey.includes("prod_")) {
    throw new Error(
      "STRIPE_SECRET_KEY contains 'prod_' which is not a valid Stripe secret key. Copy the full Test Secret key from Stripe Dashboard (Developers → API keys) and paste it exactly."
    );
  }

  if (!secretKey.startsWith("sk_")) {
    throw new Error("STRIPE_SECRET_KEY must start with 'sk_'. Paste your Stripe Secret key, not the publishable key.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getStripeAppUrl(origin?: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || origin || "http://localhost:3000";
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
