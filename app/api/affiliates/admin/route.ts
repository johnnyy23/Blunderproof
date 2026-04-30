import { NextRequest, NextResponse } from "next/server";
import { getUserFromSessionToken, sessionCookieName } from "@/lib/auth";
import { listAffiliateSummaries } from "@/lib/affiliates";

export async function GET(request: NextRequest) {
  const user = await getUserFromSessionToken(request.cookies.get(sessionCookieName)?.value);

  if (!user) {
    return NextResponse.json({ error: "Sign in to view affiliates." }, { status: 401 });
  }

  const affiliates = await listAffiliateSummaries();

  return NextResponse.json({
    affiliates: affiliates.map((summary) => ({
      affiliate: summary.affiliate,
      clickCount: summary.clickCount,
      signupCount: summary.signupCount,
      recentClicks: summary.recentClicks,
      referredUsers: summary.referredUsers
    }))
  });
}
