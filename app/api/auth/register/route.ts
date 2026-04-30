import { NextRequest, NextResponse } from "next/server";
import { registerUser, sessionCookieName } from "@/lib/auth";
import { getAffiliateByCode, referralCookieName, resolveReferralAttribution, toUserAffiliateAttribution } from "@/lib/affiliates";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string; referralCode?: string };
    const normalizedEmail = (body.email ?? "").trim().toLowerCase();
    const cookieAttribution = await resolveReferralAttribution(request.cookies.get(referralCookieName)?.value);
    let affiliateAttribution = cookieAttribution ? toUserAffiliateAttribution(cookieAttribution) : null;

    if (!affiliateAttribution && body.referralCode) {
      const affiliate = await getAffiliateByCode(body.referralCode);

      if (affiliate && affiliate.email.toLowerCase() !== normalizedEmail) {
        affiliateAttribution = {
          affiliateId: affiliate.id,
          referralCode: affiliate.referralCode,
          referredAt: new Date().toISOString()
        };
      }
    }

    if (affiliateAttribution && normalizedEmail) {
      const affiliate = await getAffiliateByCode(affiliateAttribution.referralCode);

      if (affiliate?.email.toLowerCase() === normalizedEmail) {
        affiliateAttribution = null;
      }
    }

    const { user, token } = await registerUser(body.name ?? "", body.email ?? "", body.password ?? "", affiliateAttribution);
    const response = NextResponse.json({ user });
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create account." }, { status: 400 });
  }
}
