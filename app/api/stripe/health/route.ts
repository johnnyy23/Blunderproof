import { NextResponse } from "next/server";

function isPresent(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const checks = {
    STRIPE_SECRET_KEY: isPresent(process.env.STRIPE_SECRET_KEY),
    STRIPE_PRICE_PRO_MONTHLY: isPresent(process.env.STRIPE_PRICE_PRO_MONTHLY),
    STRIPE_PRICE_PRO_YEARLY: isPresent(process.env.STRIPE_PRICE_PRO_YEARLY),
    STRIPE_WEBHOOK_SECRET: isPresent(process.env.STRIPE_WEBHOOK_SECRET),
    NEXT_PUBLIC_APP_URL: isPresent(process.env.NEXT_PUBLIC_APP_URL)
  } as const;

  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    origin: url.origin,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    expectedWebhookPath: "/api/stripe/webhook",
    expectedWebhookUrlFromOrigin: `${url.origin}/api/stripe/webhook`
  });
}
