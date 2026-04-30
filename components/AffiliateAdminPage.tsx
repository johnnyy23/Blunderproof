"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import type { Affiliate, AffiliateClick } from "@/lib/affiliates";

type AffiliateAdminPageProps = {
  currentUser: AuthUser | null;
};

type AffiliateSummary = {
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

export function AffiliateAdminPage({ currentUser }: AffiliateAdminPageProps) {
  const [affiliates, setAffiliates] = useState<AffiliateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isMounted = true;

    async function loadAffiliates() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch("/api/affiliates/admin");
        const payload = (await response.json()) as { affiliates?: AffiliateSummary[]; error?: string };

        if (!response.ok || !payload.affiliates) {
          throw new Error(payload.error || "Could not load affiliates.");
        }

        if (isMounted) {
          setAffiliates(payload.affiliates);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Could not load affiliates.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadAffiliates();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const totals = useMemo(
    () => ({
      affiliates: affiliates.length,
      clicks: affiliates.reduce((sum, item) => sum + item.clickCount, 0),
      signups: affiliates.reduce((sum, item) => sum + item.signupCount, 0)
    }),
    [affiliates]
  );
  const conversionRate = totals.clicks > 0 ? Math.round((totals.signups / totals.clicks) * 100) : 0;

  if (!currentUser) {
    return (
      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Affiliate admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Sign in to view referrals</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Phase 1 is wired for local tracking now. Once you sign in, we can show affiliates, referral clicks, and signups attributed to each partner.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Affiliate admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Referral tracking</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          This Phase 1 view shows the foundation: referral codes, clicks, and signups. Revenue, Stripe payouts, and commission accounting can layer on top once billing is live.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Affiliates" value={totals.affiliates.toString()} detail="Active partners in the local store" />
        <SummaryCard label="Tracked clicks" value={totals.clicks.toString()} detail="Valid referral landings captured" />
        <SummaryCard label="Attributed signups" value={totals.signups.toString()} detail={`${conversionRate}% click-to-signup conversion`} />
      </section>

      {isLoading ? (
        <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5 text-sm text-zinc-400">Loading affiliate data...</section>
      ) : errorMessage ? (
        <section className="rounded-lg border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">{errorMessage}</section>
      ) : (
        <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Affiliates</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Codes, clicks, and signups</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Use links like <span className="text-zinc-300">/?ref=COACHALEX</span> or{" "}
                <span className="text-zinc-300">/signup?ref=COACHALEX</span> to test first-touch attribution.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {affiliates.map((summary) => (
              <div key={summary.affiliate.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{summary.affiliate.name}</h3>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                        {summary.affiliate.referralCode}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">{summary.affiliate.email}</p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Link: <span className="text-zinc-300">/?ref={summary.affiliate.referralCode}</span>
                    </p>
                  </div>

                  <div className="grid min-w-[220px] grid-cols-2 gap-3 text-sm">
                    <MiniStat label="Clicks" value={summary.clickCount.toString()} />
                    <MiniStat label="Signups" value={summary.signupCount.toString()} />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Recent clicks</p>
                    <div className="mt-3 space-y-2 text-sm text-zinc-300">
                      {summary.recentClicks.length ? (
                        summary.recentClicks.map((click) => (
                          <div key={click.id} className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-zinc-200">{click.landingPage}</span>
                              <span className="shrink-0 text-xs text-zinc-500">{formatShortDate(click.clickedAt)}</span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500">
                              {click.utmSource ? `utm_source=${click.utmSource}` : "Direct referral"} {click.utmCampaign ? `• ${click.utmCampaign}` : ""}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">No tracked clicks yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Attributed signups</p>
                    <div className="mt-3 space-y-2 text-sm text-zinc-300">
                      {summary.referredUsers.length ? (
                        summary.referredUsers.map((user) => (
                          <div key={user.id} className="rounded-md border border-white/10 bg-black/20 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span>{user.email}</span>
                              <span className="text-xs text-zinc-500">{formatShortDate(user.createdAt)}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-500">No signups attributed yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function formatShortDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}


