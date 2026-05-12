import { createHash, randomBytes } from "crypto";

import { supabaseAdmin } from "@/lib/supabase/server";
import { listUsersForAffiliateStats, type AffiliateAttribution as UserAffiliateAttribution } from "@/lib/auth";

export const referralCookieName = "blounderproof_referral";
export const referralCookieMaxAgeSeconds = 60 * 60 * 24 * 90;

export type AffiliateStatus = "active" | "inactive";

export type Affiliate = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  commissionRate: number;
  commissionDurationMonths: number;
  status: AffiliateStatus;
  createdAt: string;
};

export type AffiliateClick = {
  id: string;
  affiliateId: string;
  referralCode: string;
  landingPage: string;
  ipHash: string;
  userAgent: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  clickedAt: string;
};

export type ReferralAttribution = {
  affiliateId: string;
  affiliateName: string;
  referralCode: string;
  capturedAt: string;
  landingPage: string;
  expiresAt: string;
};

export type AffiliateSummary = {
  affiliate: Affiliate;
  clickCount: number;
  signupCount: number;
  recentClicks: AffiliateClick[];
  referredUsers: Array<{
    id: string;
    email: string;
    createdAt: string;
    referredAt: string | null;
  }>;
};

export type ReferralCaptureResult = {
  affiliate: Affiliate | null;
  attribution: ReferralAttribution | null;
  isFirstTouch: boolean;
  didRecordClick: boolean;
};

type CaptureReferralVisitInput = {
  code: string;
  landingPage: string;
  ipAddress: string;
  userAgent: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  existingAttribution?: ReferralAttribution | null;
};

const clicksTable = "affiliate_clicks";

const defaultAffiliates: Affiliate[] = [
  {
    id: "aff_coach_alex",
    name: "Coach Alex",
    email: "alex@blunderproof.com",
    referralCode: "COACHALEX",
    commissionRate: 0.3,
    commissionDurationMonths: 12,
    status: "active",
    createdAt: "2026-04-27T00:00:00.000Z"
  },
  {
    id: "aff_natalie_rapid",
    name: "Natalie Rapid",
    email: "natalie@blunderproof.com",
    referralCode: "NATALIERAPID",
    commissionRate: 0.3,
    commissionDurationMonths: 12,
    status: "active",
    createdAt: "2026-04-27T00:00:00.000Z"
  }
];

function sanitizeAffiliate(affiliate: Affiliate): Affiliate {
  return {
    ...affiliate,
    referralCode: normalizeReferralCode(affiliate.referralCode),
    commissionRate: typeof affiliate.commissionRate === "number" ? affiliate.commissionRate : 0.3,
    commissionDurationMonths: typeof affiliate.commissionDurationMonths === "number" ? affiliate.commissionDurationMonths : 12,
    status: affiliate.status === "inactive" ? "inactive" : "active"
  };
}

function sanitizeClick(click: AffiliateClick): AffiliateClick {
  return {
    ...click,
    referralCode: normalizeReferralCode(click.referralCode),
    landingPage: click.landingPage || "/",
    ipHash: click.ipHash || "",
    userAgent: click.userAgent || "",
    utmSource: click.utmSource ?? null,
    utmMedium: click.utmMedium ?? null,
    utmCampaign: click.utmCampaign ?? null,
    utmContent: click.utmContent ?? null,
    utmTerm: click.utmTerm ?? null
  };
}

function clickFromRow(row: any): AffiliateClick {
  return sanitizeClick({
    id: row.id,
    affiliateId: row.affiliate_id,
    referralCode: row.referral_code,
    landingPage: row.landing_page,
    ipHash: row.ip_hash,
    userAgent: row.user_agent,
    utmSource: row.utm_source ?? null,
    utmMedium: row.utm_medium ?? null,
    utmCampaign: row.utm_campaign ?? null,
    utmContent: row.utm_content ?? null,
    utmTerm: row.utm_term ?? null,
    clickedAt: row.clicked_at
  });
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

export function hashIpAddress(ipAddress: string): string {
  return createHash("sha256").update(ipAddress.trim() || "unknown").digest("hex");
}

function isAttributionExpired(attribution: ReferralAttribution): boolean {
  return new Date(attribution.expiresAt).getTime() <= Date.now();
}

export function parseReferralAttribution(raw: string | undefined): ReferralAttribution | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ReferralAttribution>;

    if (
      typeof parsed.affiliateId !== "string" ||
      typeof parsed.affiliateName !== "string" ||
      typeof parsed.referralCode !== "string" ||
      typeof parsed.capturedAt !== "string" ||
      typeof parsed.landingPage !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }

    const attribution: ReferralAttribution = {
      affiliateId: parsed.affiliateId,
      affiliateName: parsed.affiliateName,
      referralCode: normalizeReferralCode(parsed.referralCode),
      capturedAt: parsed.capturedAt,
      landingPage: parsed.landingPage,
      expiresAt: parsed.expiresAt
    };

    return isAttributionExpired(attribution) ? null : attribution;
  } catch {
    return null;
  }
}

export function serializeReferralAttribution(attribution: ReferralAttribution): string {
  return JSON.stringify(attribution);
}

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  const normalizedCode = normalizeReferralCode(code);

  if (!normalizedCode) {
    return null;
  }

  return (
    defaultAffiliates.map(sanitizeAffiliate).find((affiliate) => affiliate.status === "active" && affiliate.referralCode === normalizedCode) ?? null
  );
}

export async function getAffiliateById(id: string): Promise<Affiliate | null> {
  return defaultAffiliates.map(sanitizeAffiliate).find((affiliate) => affiliate.id === id) ?? null;
}

export async function captureReferralVisit(input: CaptureReferralVisitInput): Promise<ReferralCaptureResult> {
  const normalizedCode = normalizeReferralCode(input.code);

  if (!normalizedCode) {
    return {
      affiliate: null,
      attribution: input.existingAttribution ?? null,
      isFirstTouch: false,
      didRecordClick: false
    };
  }

  const affiliate =
    defaultAffiliates.map(sanitizeAffiliate).find((entry) => entry.status === "active" && entry.referralCode === normalizedCode) ?? null;

  if (!affiliate) {
    return {
      affiliate: null,
      attribution: input.existingAttribution ?? null,
      isFirstTouch: false,
      didRecordClick: false
    };
  }

  const click: AffiliateClick = {
    id: randomBytes(10).toString("hex"),
    affiliateId: affiliate.id,
    referralCode: affiliate.referralCode,
    landingPage: input.landingPage || "/",
    ipHash: hashIpAddress(input.ipAddress),
    userAgent: input.userAgent || "unknown",
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    utmContent: input.utmContent ?? null,
    utmTerm: input.utmTerm ?? null,
    clickedAt: new Date().toISOString()
  };

  const { error } = await supabaseAdmin.from(clicksTable).insert({
    id: click.id,
    affiliate_id: click.affiliateId,
    referral_code: click.referralCode,
    landing_page: click.landingPage,
    ip_hash: click.ipHash,
    user_agent: click.userAgent,
    utm_source: click.utmSource,
    utm_medium: click.utmMedium,
    utm_campaign: click.utmCampaign,
    utm_content: click.utmContent,
    utm_term: click.utmTerm,
    clicked_at: click.clickedAt
  });

  const didRecordClick = !error;

  if (input.existingAttribution && !isAttributionExpired(input.existingAttribution)) {
    return {
      affiliate,
      attribution: input.existingAttribution,
      isFirstTouch: false,
      didRecordClick
    };
  }

  const capturedAt = new Date().toISOString();
  const attribution: ReferralAttribution = {
    affiliateId: affiliate.id,
    affiliateName: affiliate.name,
    referralCode: affiliate.referralCode,
    capturedAt,
    landingPage: input.landingPage || "/",
    expiresAt: new Date(Date.now() + referralCookieMaxAgeSeconds * 1000).toISOString()
  };

  return {
    affiliate,
    attribution,
    isFirstTouch: true,
    didRecordClick
  };
}

export async function resolveReferralAttribution(raw: string | undefined): Promise<ReferralAttribution | null> {
  const parsed = parseReferralAttribution(raw);

  if (!parsed) {
    return null;
  }

  const affiliate = await getAffiliateById(parsed.affiliateId);

  if (!affiliate || affiliate.status !== "active" || affiliate.referralCode !== parsed.referralCode) {
    return null;
  }

  return {
    ...parsed,
    affiliateName: affiliate.name
  };
}

export function toUserAffiliateAttribution(attribution: ReferralAttribution): UserAffiliateAttribution {
  return {
    affiliateId: attribution.affiliateId,
    referralCode: attribution.referralCode,
    referredAt: attribution.capturedAt
  };
}

export async function listAffiliateSummaries(): Promise<AffiliateSummary[]> {
  const users = await listUsersForAffiliateStats();

  const affiliates = defaultAffiliates.map(sanitizeAffiliate);

  const summaries = await Promise.all(
    affiliates.map(async (affiliate) => {
      const referredUsers = users.filter((user) => user.affiliateId === affiliate.id);

      const [{ count }, recentClicksResult] = await Promise.all([
        supabaseAdmin.from(clicksTable).select("id", { count: "exact", head: true }).eq("affiliate_id", affiliate.id),
        supabaseAdmin
          .from(clicksTable)
          .select("*")
          .eq("affiliate_id", affiliate.id)
          .order("clicked_at", { ascending: false })
          .limit(8)
      ]);

      const recentClicks = (recentClicksResult.data ?? []).map(clickFromRow);

      return {
        affiliate,
        clickCount: count ?? 0,
        signupCount: referredUsers.length,
        recentClicks,
        referredUsers: referredUsers.map((user) => ({
          id: user.id,
          email: anonymizeEmail(user.email),
          createdAt: user.createdAt,
          referredAt: user.referredAt
        }))
      };
    })
  );

  return summaries;
}

function anonymizeEmail(email: string): string {
  const [localPart, domain = ""] = email.split("@");

  if (!localPart) {
    return email;
  }

  const visibleLocal = localPart.length <= 2 ? `${localPart[0]}*` : `${localPart.slice(0, 2)}***`;
  return domain ? `${visibleLocal}@${domain}` : `${visibleLocal}@hidden`;
}