"use client";

import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth";

type ProfileAccountSectionProps = {
  currentUser: AuthUser | null;
  initialName: string;
  initialEmail: string;
  referralAttribution: {
    affiliateName: string;
    referralCode: string;
  } | null;
  preferredMode?: AuthMode;
  onAuthChange: (user: AuthUser | null) => void;
};

type AuthMode = "signin" | "signup";

export function ProfileAccountSection({
  currentUser,
  initialName,
  initialEmail,
  referralAttribution,
  preferredMode = "signin",
  onAuthChange
}: ProfileAccountSectionProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const isTrialSignup = !currentUser && mode === "signup";
  const trialEndLabel = currentUser?.trialEndsAt
    ? new Date(currentUser.trialEndsAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      })
    : null;
  const trialBenefits = [
    "Interactive opening and endgame training",
    "Game review that points you to the right course line",
    "Progress tracking that actually feels motivating"
  ];
  const trialSteps = [
    "Create your account",
    "Start the 7-day trial",
    "Jump straight into courses and analysis"
  ];

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmail(currentUser.email);
      setPassword("");
      setConfirmPassword("");
    } else {
      setName(initialName);
      setEmail(initialEmail);
    }
  }, [currentUser, initialEmail, initialName]);

  useEffect(() => {
    if (!currentUser) {
      setMode(preferredMode);
    }
  }, [currentUser, preferredMode]);

  async function startTrialCheckout(billingEmail: string) {
    const response = await fetch("/api/auth/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "pro", billingCycle: "monthly", billingEmail })
    });
    const payload = (await response.json()) as { checkoutUrl?: string; error?: string };

    if (!response.ok || !payload.checkoutUrl) {
      throw new Error(payload.error || "Could not open Stripe checkout.");
    }

    window.location.href = payload.checkoutUrl;
  }

  async function handleAuthSubmit() {
    setErrorMessage("");
    setStatusMessage("");

    if (mode === "signup" && password !== confirmPassword) {
      setErrorMessage("Passwords need to match.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          referralCode: mode === "signup" ? referralAttribution?.referralCode : undefined
        })
      });
      const payload = (await response.json()) as { user?: AuthUser; error?: string };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not continue.");
      }

      onAuthChange(payload.user);
      setStatusMessage(mode === "signup" ? "Account created." : "Signed in.");
      setPassword("");
      setConfirmPassword("");

      if (mode === "signup" && preferredMode === "signup") {
        await startTrialCheckout(payload.user.billingEmail || email);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleProfileSave() {
    setErrorMessage("");
    setStatusMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      });
      const payload = (await response.json()) as { user?: AuthUser; error?: string };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not save profile.");
      }

      onAuthChange(payload.user);
      setStatusMessage("Profile updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordSave() {
    setErrorMessage("");
    setStatusMessage("");

    if (nextPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not change password.");
      }

      setCurrentPassword("");
      setNextPassword("");
      setStatusMessage("Password updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleOpenBillingPortal() {
    setErrorMessage("");
    setStatusMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/auth/portal", { method: "POST" });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Could not open Stripe customer portal.");
      }

      window.location.href = payload.url;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not open customer portal.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    setErrorMessage("");
    setStatusMessage("");
    setIsSaving(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      onAuthChange(null);
      setStatusMessage("Signed out.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Account</p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {currentUser
              ? "Your account"
              : preferredMode === "signup"
                ? "Start your free trial"
                : "Sign in or create an account"}
          </h2>
          {!currentUser ? (
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {preferredMode === "signup"
                ? "Create your account, start a 7-day trial, and jump straight into the training flow."
                : "Sign in to keep your progress synced or create an account when you are ready to start training."}
            </p>
          ) : null}
        </div>
        {currentUser ? (
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] text-emerald-100">Signed in</span>
        ) : null}
      </div>

      {!currentUser ? (
        <>
          {isTrialSignup ? (
            <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">7-day free trial</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                    Get into the courses, analysis, and interactive trainer right away.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200/20 bg-black/15 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                  No charge today
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-emerald-50/90 sm:grid-cols-3">
                {trialBenefits.map((benefit) => (
                  <div key={benefit} className="rounded-md border border-emerald-200/10 bg-black/10 px-3 py-3">
                    {benefit}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-emerald-200/10 bg-black/10 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100/80">What happens next</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {trialSteps.map((step, index) => (
                    <div key={step} className="rounded-md border border-emerald-200/10 bg-black/10 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100/70">Step {index + 1}</p>
                      <p className="mt-2 text-sm text-emerald-50/90">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 inline-flex rounded-md border border-white/10 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={[
                "rounded px-3 py-2 text-xs font-semibold transition",
                mode === "signin" ? "bg-emerald-300 text-zinc-950" : "text-zinc-300 hover:bg-white/[0.05]"
              ].join(" ")}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={[
                "rounded px-3 py-2 text-xs font-semibold transition",
                mode === "signup" ? "bg-emerald-300 text-zinc-950" : "text-zinc-300 hover:bg-white/[0.05]"
              ].join(" ")}
            >
              Create account
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            {mode === "signup" && referralAttribution ? (
              <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm text-cyan-100">
                Referred by <span className="font-semibold">{referralAttribution.affiliateName}</span>
              </div>
            ) : null}

            {mode === "signup" ? (
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                  placeholder="Your name"
                />
              </label>
            ) : null}

            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                placeholder="you@example.com"
              />
            </label>

            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                placeholder="At least 8 characters"
              />
            </label>

            {mode === "signup" ? (
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Confirm password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                  placeholder="Repeat your password"
                />
              </label>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleAuthSubmit}
            disabled={isSaving}
            className="mt-4 w-full rounded-md bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : mode === "signup" ? "Start free trial" : "Sign in"}
          </button>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
            {mode === "signup" ? (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">Takes under a minute</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Full product access during trial</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Cancel anytime</span>
              </>
            ) : (
              <>
                <span className="rounded-full border border-white/10 px-2 py-1">Pick up your progress</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Sync your courses and review queue</span>
              </>
            )}
          </div>

          {mode === "signup" ? (
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              We will collect payment details to start your 7-day free trial. No charge today, and you can cancel anytime before renewal.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              New here? Switch to create account and we&apos;ll put you straight into the free-trial path.
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Plan and billing status</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {currentUser.membershipStatus === "trialing"
                    ? `You are currently on the free trial${trialEndLabel ? ` until ${trialEndLabel}` : ""}.`
                    : "Your account is active and ready for billing once Stripe is connected."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
            {currentUser.stripeCustomerId ? (
              <button
                type="button"
                onClick={handleOpenBillingPortal}
                disabled={isSaving}
                className="rounded-md bg-[#007BFF] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(54,208,255,0.25)] transition hover:bg-[#36D0FF] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Manage subscription
              </button>
            ) : null}
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-300">
                  {currentUser.membershipPlan} plan
                </span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
                  {currentUser.billingState.replace(/_/g, " ")}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
              <span className="rounded-full border border-white/10 px-2 py-1">No charge captured yet</span>
              <span className="rounded-full border border-white/10 px-2 py-1">Manage in Stripe portal</span>
              {currentUser.stripeCustomerId ? (
                <span className="rounded-full border border-white/10 px-2 py-1">Customer linked</span>
              ) : (
                <span className="rounded-full border border-white/10 px-2 py-1">Customer not linked yet</span>
              )}
            </div>
          </div>

          <div className="grid gap-3">
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Display name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleProfileSave}
              disabled={isSaving}
              className="rounded-md bg-emerald-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save profile"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSaving}
              className="rounded-md border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign out
            </button>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">Change password</p>
            <div className="mt-3 grid gap-3">
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Current password</span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">New password</span>
                <input
                  type="password"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                  className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handlePasswordSave}
              disabled={isSaving}
              className="mt-4 rounded-md border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Update password
            </button>
          </div>
        </div>
      )}

      {statusMessage ? <p className="mt-4 text-sm text-emerald-200">{statusMessage}</p> : null}
      {errorMessage ? <p className="mt-2 text-sm text-rose-200">{errorMessage}</p> : null}
    </section>
  );
}
