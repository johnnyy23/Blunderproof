import { NextRequest, NextResponse } from "next/server";
import {
  captureReferralVisit,
  getAffiliateById,
  referralCookieMaxAgeSeconds,
  referralCookieName,
  resolveReferralAttribution,
  serializeReferralAttribution
} from "@/lib/affiliates";

type ReferralCaptureBody = {
  ref?: string;
  landingPage?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
};

export async function GET(request: NextRequest) {
  const attribution = await resolveReferralAttribution(request.cookies.get(referralCookieName)?.value);
  return NextResponse.json({ attribution });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReferralCaptureBody;
    const existingAttribution = await resolveReferralAttribution(request.cookies.get(referralCookieName)?.value);
    const landingPage = body.landingPage || `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const result = await captureReferralVisit({
      code: body.ref ?? "",
      landingPage,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown",
      userAgent: request.headers.get("user-agent") || "unknown",
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
      utmContent: body.utmContent ?? null,
      utmTerm: body.utmTerm ?? null,
      existingAttribution
    });

    const activeAffiliate = result.attribution ? await getAffiliateById(result.attribution.affiliateId) : result.affiliate;

    const response = NextResponse.json({
      attribution: result.attribution,
      affiliate: activeAffiliate
        ? {
            id: activeAffiliate.id,
            name: activeAffiliate.name,
            referralCode: activeAffiliate.referralCode
          }
        : null,
      isFirstTouch: result.isFirstTouch
    });

    if (result.attribution) {
      response.cookies.set(referralCookieName, serializeReferralAttribution(result.attribution), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: referralCookieMaxAgeSeconds
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not capture referral." }, { status: 400 });
  }
}
