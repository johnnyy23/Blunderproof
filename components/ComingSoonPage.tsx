"use client";

import { useMemo, useState } from "react";

type ComingSoonPageProps = {
  onGetEarlyAccess: (email: string) => void;
  onLogin: () => void;
};

export function ComingSoonPage({ onGetEarlyAccess, onLogin }: ComingSoonPageProps) {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const previewBullets = useMemo(
    () => [
      "Interactive opening and endgame training",
      "Blunder-focused practice that shows what to train next",
      "A cleaner way to improve without drowning in theory"
    ],
    []
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("Enter a valid email to get early access.");
      return;
    }

    setErrorMessage("");
    onGetEarlyAccess(trimmedEmail);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_28%),linear-gradient(180deg,#09100c_0%,#0d1411_54%,#0e1512_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <img
              src="/blounderproof-logo.png"
              alt="BlunderProof logo"
              className="h-14 w-14 rounded-xl object-cover shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">BLUNDERPROOF.IO</p>
              <p className="mt-1 text-sm text-zinc-400">Interactive chess training is on the way</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogin}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
          >
            Login
          </button>
        </header>

        <section className="flex flex-1 items-center py-10 lg:py-16">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Coming soon</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
                Stop Blundering. Start Winning.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-300">
                BlunderProof is building a smarter way to train chess openings, clean up common mistakes, and improve faster with interactive practice.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {previewBullets.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-4 text-sm leading-6 text-zinc-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-emerald-300/15 bg-zinc-950/70 p-6 shadow-[0_24px_100px_rgba(0,0,0,0.35)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Get early access</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Be first in line when we launch.</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Enter your email and we will take you straight into the early-access signup flow.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <label className="block text-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Email address</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base text-white outline-none placeholder:text-zinc-500"
                  />
                </label>

                {errorMessage ? <p className="text-sm text-rose-300">{errorMessage}</p> : null}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_18px_48px_rgba(74,222,128,0.24)] transition hover:bg-emerald-300"
                >
                  Get Early Access
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">What you can expect</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                  <li>Interactive course training built for real improvement</li>
                  <li>Opening, endgame, and game-review tools in one place</li>
                  <li>Clean, focused lessons for beginners through club players</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
            <p className="font-semibold uppercase tracking-[0.18em] text-zinc-300">BlunderProof.io</p>
            <div className="flex flex-wrap items-center gap-4">
              <span>Coming soon</span>
              <button type="button" onClick={onLogin} className="transition hover:text-white">
                Login
              </button>
              <a href="mailto:hello@blunderproof.io" className="transition hover:text-white">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
