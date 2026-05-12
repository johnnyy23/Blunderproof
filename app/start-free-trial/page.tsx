"use client";

import { useEffect, useMemo, useState } from "react";
import { ProfileAccountSection } from "@/components/ProfileAccountSection";
import type { AuthUser } from "@/lib/auth";

function primaryButtonClassName(className?: string) {
  return [
    "rounded-xl bg-[#007BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(54,208,255,0.25)] transition hover:bg-[#36D0FF]",
    className
  ]
    .filter(Boolean)
    .join(" ");
}

export default function StartFreeTrialPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("focus") === "checkout") {
      document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const trialEndLabel = useMemo(() => {
    if (!authUser?.trialEndsAt) return null;
    return new Date(authUser.trialEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [authUser?.trialEndsAt]);

  async function handleStartCheckout() {
    setCheckoutError("");

    if (!authUser) {
      document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    setIsStartingCheckout(true);

    try {
      const response = await fetch("/api/auth/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "pro",
          billingCycle: "monthly",
          billingEmail: authUser.billingEmail || authUser.email
        })
      });
      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Could not open Stripe checkout.");
      }

      window.location.href = payload.checkoutUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not open Stripe checkout.");
    } finally {
      setIsStartingCheckout(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_28%),linear-gradient(180deg,#0b0f0d_0%,#0f1513_48%,#101715_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-4 backdrop-blur">
          <a href="/" className="flex items-center gap-3">
            <img
              src="/blounderproof-logo.png"
              alt="BlunderProof logo"
              className="h-12 w-12 rounded-xl object-cover shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">BLUNDERPROOF</p>
              <p className="mt-1 text-sm text-zinc-400">7-day free trial • No charge today</p>
            </div>
          </a>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/"
              className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.06]"
            >
              Back
            </a>
            <button type="button" onClick={handleStartCheckout} className={primaryButtonClassName()}>
              Continue to checkout
            </button>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-8 shadow-[0_30px_120px_rgba(0,0,0,0.35)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Stop blundering</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-white sm:text-5xl">Start Winning.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-300">
              Start a 7-day free trial to unlock Pro features like full analysis, deeper training, and faster improvement.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" })} className={primaryButtonClassName()}>
                Start Free Trial
              </button>
              <a
                href="/?view=courses"
                className="rounded-xl border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.06]"
              >
                View courses
              </a>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: "7-day free trial",
                  description: "Try Pro features for a full week."
                },
                {
                  title: "No charge today",
                  description: "Payment info now, billing after trial."
                },
                {
                  title: "Cancel anytime",
                  description: "Cancel before renewal and pay nothing."
                }
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-3xl border border-cyan-200/20 bg-cyan-200/5 p-7 shadow-[0_30px_120px_rgba(0,0,0,0.35)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Checkout</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Pro (monthly)</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Starts after the trial ends. Cancel any time before renewal.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">What happens next</p>
              <ol className="mt-3 space-y-2 text-sm text-zinc-300">
                <li>1) Create your account</li>
                <li>2) Add payment details</li>
                <li>3) Enjoy 7 days of Pro access</li>
              </ol>
              <p className="mt-4 text-xs text-zinc-400">
                You won&apos;t be charged today. If you cancel during the trial, you keep access until it ends.
              </p>
            </div>

            {checkoutError ? <p className="mt-4 text-sm text-red-200">{checkoutError}</p> : null}

            <button type="button" onClick={handleStartCheckout} disabled={isStartingCheckout} className={primaryButtonClassName("mt-6 w-full justify-center")}> 
              {isStartingCheckout ? "Opening Stripe..." : authUser ? "Continue to secure checkout" : "Create account to continue"}
            </button>

            {authUser?.billingState === "trial" ? (
              <p className="mt-4 text-sm text-emerald-100">
                Trial active{trialEndLabel ? ` until ${trialEndLabel}` : ""}.
              </p>
            ) : null}
          </aside>
        </section>

        <section id="checkout" className="mt-10 rounded-3xl border border-white/10 bg-zinc-950/50 p-8 backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Step 1</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Create your account</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                We&apos;ll use this account to track your progress and keep your trial access active even if you cancel before renewal.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
              <ProfileAccountSection
                currentUser={authUser}
                initialName=""
                initialEmail=""
                referralAttribution={null}
                preferredMode="signup"
                onAuthChange={setAuthUser}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
