"use client";

import type { TrainingLine, TrainingMove } from "@/lib/courses";
import type { LineStatus } from "@/lib/trainer";
import type { ReviewGrade, TrainingStatus } from "@/types/chess";

type TrainerPanelProps = {
  line: TrainingLine;
  move: TrainingMove;
  moveIndex: number;
  status: TrainingStatus;
  lineStatus: LineStatus;
  reviewLabel: string;
  moveHistory: string[];
  trainingMode: "study" | "test";
  soundEnabled: boolean;
  dueLineCount: number;
  mistakeLineCount: number;
  reviewedLineCount: number;
  totalLineCount: number;
  masteredLineCount: number;
  shakyLineCount: number;
  canUndoMove: boolean;
  canGoPreviousLine: boolean;
  onToggleSound: () => void;
  onTrainingModeChange: (mode: "study" | "test") => void;
  replayIndex: number | null;
  replayCount: number;
  onReplayPrevious: () => void;
  onReplayNext: () => void;
  onReveal: () => void;
  onHint: () => void;
  onUndoMove: () => void;
  onReset: () => void;
  onPreviousLine: () => void;
  onNextLine: () => void;
  onNextDueLine: () => void;
  onNextMistakeLine: () => void;
  onGradeReview: (grade: ReviewGrade) => void;
};

export function TrainerPanel({
  line,
  move,
  moveIndex,
  status,
  lineStatus,
  reviewLabel,
  moveHistory,
  trainingMode,
  soundEnabled,
  dueLineCount,
  mistakeLineCount,
  reviewedLineCount,
  totalLineCount,
  masteredLineCount,
  shakyLineCount,
  canUndoMove,
  canGoPreviousLine,
  onToggleSound,
  onTrainingModeChange,
  replayIndex,
  replayCount,
  onReplayPrevious,
  onReplayNext,
  onReveal,
  onHint,
  onUndoMove,
  onReset,
  onPreviousLine,
  onNextLine,
  onNextDueLine,
  onNextMistakeLine,
  onGradeReview
}: TrainerPanelProps) {
  const isLineComplete = status === "correct" && moveIndex === line.moves.length - 1;
  const showAnswer = status === "correct" || status === "revealed";
  const showCoaching = trainingMode === "study" ? showAnswer : isLineComplete;
  const canGrade = showAnswer && moveIndex === line.moves.length - 1;
  void lineStatus;
  void dueLineCount;
  void mistakeLineCount;
  void reviewedLineCount;
  void totalLineCount;
  void masteredLineCount;
  void shakyLineCount;

  return (
    <section className="self-start rounded-lg border border-white/10 bg-zinc-950/60 p-5 xl:sticky xl:top-5 xl:max-h-[calc(100vh-2.5rem)] xl:overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">{reviewLabel}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{line.name}</h2>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-300">
          Move {moveIndex + 1}/{line.moves.length}
        </span>
      </div>

      <div className="mt-4 inline-flex rounded-md border border-white/10 bg-white/[0.03] p-1">
        {(["study", "test"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onTrainingModeChange(mode)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-semibold capitalize transition",
              trainingMode === mode ? "bg-emerald-300 text-zinc-950" : "text-zinc-300 hover:bg-white/[0.05]"
            ].join(" ")}
          >
            {mode} mode
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleSound}
        className="ml-3 inline-flex rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.05]"
      >
        {soundEnabled ? "Sound on" : "Sound off"}
      </button>

      <div className="mt-5 rounded-md border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-medium text-zinc-200">{move.prompt}</p>
        {status === "incorrect" ? <p className="mt-3 text-sm text-amber-200">That move is legal, but it is not the course move for this prompt.</p> : null}
        {showAnswer ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-sm text-zinc-400">Correct move</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-200">{move.san}</p>
            {status === "revealed" ? <p className="mt-2 text-sm text-zinc-400">You can play it on the board or use the button below.</p> : null}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-20 -mx-1 mt-5 border-t border-white/10 bg-zinc-950/95 px-1 pt-4 pb-1 backdrop-blur">
        <div className="flex flex-wrap gap-2">
        {trainingMode === "study" ? (
          <>
            <button
              type="button"
              onClick={onHint}
              disabled={showAnswer}
              className="rounded-md border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Hint
            </button>
            <button
              type="button"
              onClick={onReveal}
              disabled={showAnswer}
              className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-55"
            >
              Reveal move
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={onUndoMove}
          disabled={!canUndoMove}
          className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Undo move
        </button>
        <button type="button" onClick={onReset} className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]">
          Reset line
        </button>
        <button
          type="button"
          onClick={onPreviousLine}
          disabled={!canGoPreviousLine}
          className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
        >
          Previous line
        </button>
        <button type="button" onClick={onNextLine} className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]">
          {isLineComplete ? "Next line" : "Skip line"}
        </button>
        <button type="button" onClick={onNextDueLine} className="rounded-md border border-emerald-300/30 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/10">
          Next due
        </button>
        <button type="button" onClick={onNextMistakeLine} className="rounded-md border border-rose-300/25 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/10">
          Next mistake
        </button>
        </div>
      </div>

      {showCoaching ? (
        <div className="mt-5 space-y-4">
          {isLineComplete ? (
            <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-4">
              <h3 className="text-sm font-semibold text-emerald-100">Line complete</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-300">Nice. You finished this line and can move straight to the next one.</p>
              <p className="mt-2 text-xs leading-5 text-emerald-50/80">
                Use ← and → to review earlier and later positions in the line{replayIndex !== null ? ` (${replayIndex + 1}/${replayCount})` : ""}.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onReplayPrevious}
                  disabled={replayIndex === null || replayIndex <= 0}
                  className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={onReplayNext}
                  disabled={replayIndex === null || replayIndex >= replayCount - 1}
                  className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Next →
                </button>
              </div>
              <button type="button" onClick={onNextLine} className="mt-3 rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200">
                Next line
              </button>
            </div>
          ) : null}
          <div>
            <h3 className="text-sm font-semibold text-white">Why it works</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{move.explanation}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Practical plan</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{move.plan}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">Key idea</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{summarizeKeyIdea(move.plan)}</p>
            </div>
            <div className="rounded-md border border-amber-300/15 bg-amber-300/5 p-4">
              <h3 className="text-sm font-semibold text-amber-100">Common mistake</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{getCommonMistake(move)}</p>
            </div>
          </div>
          {canGrade ? (
            <div>
              <h3 className="text-sm font-semibold text-white">Review grade</h3>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {(["again", "hard", "good", "easy"] as ReviewGrade[]).map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => onGradeReview(grade)}
                    className="rounded-md border border-white/10 px-2 py-2 text-sm font-semibold capitalize text-zinc-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 border-t border-white/10 pt-4">
        <h3 className="text-sm font-semibold text-white">Move history</h3>
        <div className="mt-3 min-h-10 rounded-md bg-black/20 p-3 text-sm text-zinc-300">
          {moveHistory.length ? formatMoveHistory(moveHistory) : "Your training moves will appear here."}
        </div>
      </div>
    </section>
  );
}

function formatMoveHistory(moveHistory: string[]): string {
  const chunks: string[] = [];

  for (let index = 0; index < moveHistory.length; index += 2) {
    const moveNumber = Math.floor(index / 2) + 1;
    const whiteMove = moveHistory[index];
    const blackMove = moveHistory[index + 1];

    chunks.push(`${moveNumber}. ${whiteMove}${blackMove ? ` ${blackMove}` : ""}`);
  }

  return chunks.join("  ");
}

function summarizeKeyIdea(plan: string): string {
  const firstSentence = plan.split(".")[0]?.trim();
  return firstSentence ? `${firstSentence}.` : plan;
}

function getCommonMistake(move: TrainingMove): string {
  if (move.commonMistake?.trim()) {
    return move.commonMistake;
  }

  if (/castle/i.test(move.plan)) {
    return "A common mistake here is rushing the attack before finishing development and king safety.";
  }

  if (/center|central/i.test(move.explanation) || /center|central/i.test(move.plan)) {
    return "A common mistake here is making a routine developing move and letting the center drift instead of following the point of the line.";
  }

  if (/trade|exchange/i.test(move.explanation)) {
    return "A common mistake here is avoiding the simplifying trade and letting the opponent keep their best attacking piece.";
  }

  return "A common mistake here is playing a normal-looking move instead of following the specific practical idea this line is trying to teach.";
}
