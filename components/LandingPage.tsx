"use client";

import type { OpeningCourse } from "@/lib/courses";
import { getNextEnPassantTarget, getUpdatedCastlingRights, makeMove, parseFen, parseUciMove } from "@/lib/chess";
import type { Board, CastlingRights, ChessPiece, PieceColor, Square } from "@/types/chess";

type LandingPageProps = {
  featuredCourse: OpeningCourse;
  onStartFreeTrial: () => void;
  onViewCourses: () => void;
  onLogin: () => void;
};

const pieceGlyph: Record<ChessPiece["color"], Record<ChessPiece["type"], string>> = {
  white: {
    king: "\u2654",
    queen: "\u2655",
    rook: "\u2656",
    bishop: "\u2657",
    knight: "\u2658",
    pawn: "\u2659"
  },
  black: {
    king: "\u265A",
    queen: "\u265B",
    rook: "\u265C",
    bishop: "\u265D",
    knight: "\u265E",
    pawn: "\u265F"
  }
};

const howItWorks = [
  {
    title: "Choose a Course",
    description: "Pick an opening, endgame, or practical study plan that matches your level and what you actually want to fix."
  },
  {
    title: "Train the Lines",
    description: "Work through interactive lines, board previews, and repetition so the moves stick under pressure."
  },
  {
    title: "Track Your Progress",
    description: "Review your trouble spots, build consistency, and see where your training is turning into better results."
  }
];

const featureHighlights = [
  {
    title: "Interactive opening courses",
    description: "Memorize key move orders with a trainer that keeps you engaged instead of dumping theory at you."
  },
  {
    title: "Blunder-focused training",
    description: "Spot the exact branches where your games go wrong and jump straight into the line you need next."
  },
  {
    title: "PGN import and course creation",
    description: "Bring in your own study material, build custom courses, and get Stockfish-assisted suggestions while creating."
  },
  {
    title: "Progress tracking",
    description: "See your review queue, streaks, analysis signals, and course progress without digging through menus."
  },
  {
    title: "Beginner-to-club-player friendly lessons",
    description: "The whole product is built for players who want practical improvement, not lecture-style overwhelm."
  },
  {
    title: "Community courses marketplace",
    description: "We are setting up a creator layer so strong community repertoires and lesson packs can live alongside the core library."
  }
];

const trustHighlights = [
  "Interactive training that feels like real practice",
  "Built for beginners through serious club players",
  "Game review that points you to the right line next"
];

const testimonials = [
  {
    quote: "This made openings finally click. I stopped guessing and finally started remembering what I actually wanted to play.",
    name: "Daniel R.",
    role: "1200 rapid player"
  },
  {
    quote: "Perfect for players who want structure without feeling buried in theory. It feels practical right away.",
    name: "Maya T.",
    role: "club player"
  },
  {
    quote: "The training flow actually makes me want to come back every day. It feels more like a system than a pile of lessons.",
    name: "Chris P.",
    role: "improving adult learner"
  }
];

export function LandingPage({ featuredCourse, onStartFreeTrial, onViewCourses, onLogin }: LandingPageProps) {
  const previewBoard = buildPreviewBoard(featuredCourse);
  const sections = Array.from(new Set(featuredCourse.lines.map((line) => line.section).filter(Boolean))).slice(0, 3);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_28%),linear-gradient(180deg,#0b0f0d_0%,#0f1513_48%,#101715_100%)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-zinc-950/50 px-4 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <img
              src="/blounderproof-logo.png"
              alt="BlunderProof logo"
              className="h-14 w-14 rounded-xl object-cover shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">BLUNDERPROOF</p>
              <p className="mt-1 text-sm text-zinc-400">Openings, endgames, analysis, and community</p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <a href="#how-it-works" className="rounded-md px-3 py-2 text-zinc-300 transition hover:bg-white/[0.05] hover:text-white">
              How it works
            </a>
            <a href="#features" className="rounded-md px-3 py-2 text-zinc-300 transition hover:bg-white/[0.05] hover:text-white">
              Features
            </a>
            <a href="#pricing" className="rounded-md px-3 py-2 text-zinc-300 transition hover:bg-white/[0.05] hover:text-white">
              Pricing
            </a>
            <button
              type="button"
              onClick={onLogin}
              className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-2 font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
            >
              Login
            </button>
          </nav>
        </header>

        <section className="grid gap-8 pt-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Monthly chess training that sticks</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Stop Blundering. Start Winning.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-300">
              BlunderProof helps players build stronger openings, avoid common mistakes, and train smarter with interactive chess courses.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStartFreeTrial}
                className="rounded-xl bg-[#007BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(54,208,255,0.25)] transition hover:bg-[#36D0FF]"
              >
                Start Free Trial
              </button>
              <button
                type="button"
                onClick={onViewCourses}
                className="rounded-xl border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.06]"
              >
                View Courses
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {trustHighlights.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-emerald-300/15 bg-emerald-300/8 px-3 py-2 text-xs font-medium text-emerald-50/90"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-2xl font-semibold text-white">Openings</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Train key move orders before they become over-the-board panic.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-2xl font-semibold text-white">Endgames</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">Build conversion skills so good positions actually turn into points.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-2xl font-semibold text-white">Analysis</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">See what you are struggling with and jump straight into the right fix.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-emerald-300/15 bg-zinc-950/65 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">Course preview</p>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                    Interactive
                  </span>
                </div>
                <MiniBoard board={previewBoard} />
              </div>

              <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Featured course</p>
                <h2 className="mt-3 text-xl font-semibold text-white">{featuredCourse.name}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{featuredCourse.description}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                  <span className="rounded-full border border-white/10 px-2 py-1">{featuredCourse.lines.length} lessons</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">{featuredCourse.repertoire}</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">{featuredCourse.level}</span>
                </div>

                {sections.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sections.map((section) => (
                      <span key={section} className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-zinc-300">
                        {section}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Why it helps</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Drill the exact lines, get instant feedback, and build pattern memory that holds up when the game gets messy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="pt-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Simple training flow. Real improvement.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {howItWorks.map((item, index) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-300/12 text-sm font-semibold text-emerald-100">
                  0{index + 1}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="pt-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Feature highlights</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Everything points back to cleaner, stronger chess.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureHighlights.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-white/10 bg-zinc-950/50 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/12 text-lg text-emerald-100">+</div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="pt-20">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div className="rounded-3xl border border-white/10 bg-zinc-950/55 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Pricing</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Train monthly or lock in a full year.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
                Start with a free trial, learn the system, and then choose the plan that fits how seriously you want to train.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm font-semibold text-white">Monthly</p>
                  <p className="mt-3 text-3xl font-semibold text-white">$5</p>
                  <p className="mt-1 text-sm text-zinc-400">per month</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-400">Flexible access for players who want a low-friction way to keep improving.</p>
                </div>
                <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-5 shadow-[0_18px_48px_rgba(74,222,128,0.12)]">
                  <p className="text-sm font-semibold text-emerald-100">Yearly</p>
                  <p className="mt-3 text-3xl font-semibold text-white">$39</p>
                  <p className="mt-1 text-sm text-zinc-300">per year</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-300">Best value if you want a full year of openings, endgames, and review tools in one place.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-sm font-semibold text-white">Free Trial</p>
                  <p className="mt-3 text-3xl font-semibold text-white">7 days</p>
                  <p className="mt-1 text-sm text-zinc-400">to explore the platform</p>
                  <p className="mt-4 text-sm leading-6 text-zinc-400">7-day free trial. No charge today. Cancel anytime before renewal.</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-950/75 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Start here</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">Get the full training loop</h3>
              <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 px-4 py-4">
                <p className="text-sm font-semibold text-emerald-100">Best value: yearly plan</p>
                <p className="mt-2 text-sm leading-6 text-emerald-50/90">
                  Train for a full year, save compared with monthly billing, and give your openings, endgames, and review habits enough time to compound.
                </p>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-zinc-300">
                <li className="flex gap-3"><span className="mt-0.5 text-emerald-200">•</span><span>Interactive opening and endgame study</span></li>
                <li className="flex gap-3"><span className="mt-0.5 text-emerald-200">•</span><span>Analysis that points you to the exact line to train</span></li>
                <li className="flex gap-3"><span className="mt-0.5 text-emerald-200">•</span><span>Course creation, PGN import, and future community packs</span></li>
              </ul>
              {/* Stripe checkout / free-trial subscription flow will connect to this CTA later. */}
              <button
                type="button"
                onClick={onStartFreeTrial}
                className="mt-8 w-full rounded-xl bg-[#007BFF] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(54,208,255,0.25)] transition hover:bg-[#36D0FF]"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </section>

        <section className="pt-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Social proof</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Players should feel the difference quickly.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <div key={testimonial.quote} className="rounded-2xl border border-white/10 bg-zinc-950/55 p-5">
                <p className="text-lg leading-8 text-zinc-100">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="mt-5">
                  <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pt-20">
          <div className="rounded-[32px] border border-emerald-300/15 bg-[linear-gradient(135deg,rgba(34,197,94,0.18),rgba(17,24,39,0.18))] px-6 py-10 text-center shadow-[0_24px_100px_rgba(34,197,94,0.12)]">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Final call</p>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Ready to make your chess blunder proof?</h2>
            <button
              type="button"
              onClick={onStartFreeTrial}
              className="mt-8 rounded-xl bg-[#007BFF] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(54,208,255,0.25)] transition hover:bg-[#36D0FF]"
            >
              Start Free Trial
            </button>
          </div>
        </section>

        <footer className="mt-20 border-t border-white/10 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-400">
            <p className="font-semibold uppercase tracking-[0.18em] text-zinc-300">BlunderProof.io</p>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={onViewCourses} className="transition hover:text-white">Courses</button>
              <a href="#pricing" className="transition hover:text-white">Pricing</a>
              <button type="button" onClick={onLogin} className="transition hover:text-white">Login</button>
              <span>Terms</span>
              <span>Privacy</span>
              <a href="mailto:hello@blunderproof.io" className="transition hover:text-white">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function MiniBoard({ board }: { board: Board }) {
  return (
    <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-xl border border-white/10">
      {board.map((rank, rankIndex) =>
        rank.map((piece, fileIndex) => {
          const isLight = (rankIndex + fileIndex) % 2 === 0;

          return (
            <div
              key={`${rankIndex}-${fileIndex}`}
              className={[
                "grid aspect-square place-items-center text-[18px] font-bold leading-none sm:text-[22px]",
                isLight ? "bg-[#ecd8b0]" : "bg-[#c9a477]",
                piece?.color === "white"
                  ? "text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.55)]"
                  : "text-zinc-950"
              ].join(" ")}
            >
              {piece ? pieceGlyph[piece.color][piece.type] : ""}
            </div>
          );
        })
      )}
    </div>
  );
}

function buildPreviewBoard(course: OpeningCourse): Board {
  const firstLine = course.lines[0];

  if (!firstLine) {
    return parseFen("8/8/8/8/8/8/8/8 w - - 0 1").board;
  }

  const parsed = parseFen(firstLine.fen);
  let board = parsed.board;
  let turn: PieceColor = parsed.turn;
  let castlingRights: CastlingRights = parsed.castlingRights;
  let enPassantTarget: Square | null = parsed.enPassantTarget;
  const previewMoves = [...(firstLine.prelude ?? []), ...firstLine.moves.slice(0, 2).flatMap((move) => [move, move.opponentReply].filter(Boolean))];

  for (const move of previewMoves) {
    if (!move) {
      continue;
    }

    const parsedMove = parseUciMove(move.uci);
    const previousBoard = board;
    const previousCastlingRights = castlingRights;
    const result = makeMove(board, parsedMove.from, parsedMove.to, {
      promotion: parsedMove.promotion,
      castlingRights,
      enPassantTarget
    });

    if (!result) {
      break;
    }

    board = result.board;
    turn = turn === "white" ? "black" : "white";
    castlingRights = getUpdatedCastlingRights(previousBoard, parsedMove.from, parsedMove.to, previousCastlingRights);
    enPassantTarget = getNextEnPassantTarget(previousBoard, parsedMove.from, parsedMove.to);
  }

  return board;
}

