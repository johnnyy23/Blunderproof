"use client";

import type { OpeningCourse } from "@/lib/courses";
import type { TrainerProgress } from "@/lib/trainer";
import { getNextEnPassantTarget, getUpdatedCastlingRights, makeMove, parseFen, parseUciMove } from "@/lib/chess";
import type { Board, CastlingRights, ChessPiece, Square } from "@/types/chess";

type RemoteUserProgress = {
  course_id: string;
  line_id: string;
  last_move_index: number | null;
  updated_at?: string;
};

type CourseCatalogProps = {
  courses: OpeningCourse[];
  activeCourseId: string;
  progress: TrainerProgress;
  onSelectCourse: (courseId: string) => void;
  remoteProgress?: Record<string, RemoteUserProgress>;
  onResume?: (courseId: string, lineId: string) => void;
};

export function CourseCatalog({ courses, activeCourseId, progress, onSelectCourse, remoteProgress, onResume }: CourseCatalogProps) {
  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Courses</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Your study library</h2>
          <p className="mt-1 text-sm text-zinc-400">Pick a course to open its dedicated board page and train through the full line set.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => {
          const reviewedCount = course.lines.filter((line) => Boolean(progress.lines[line.id]?.lastReviewedAt)).length;
          const sections = Array.from(new Set(course.lines.map((line) => line.section).filter(Boolean)));
          const isActive = course.id === activeCourseId;
          const courseType = inferCourseType(course);
          const resumeEntry =
            remoteProgress && onResume
              ? course.lines
                  .map((line) => remoteProgress[`${course.id}:${line.id}`])
                  .filter((entry): entry is RemoteUserProgress => Boolean(entry))
                  .sort((left, right) => (right.updated_at ?? "").localeCompare(left.updated_at ?? ""))[0]
              : null;

          return (
            <div
              key={course.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCourse(course.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectCourse(course.id);
                }
              }}
              className={[
                "cursor-pointer rounded-lg border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-300/40",
                isActive
                  ? "border-emerald-300/35 bg-emerald-300/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
              ].join(" ")}
            >
              <div className="grid gap-4 sm:grid-cols-[124px_minmax(0,1fr)]">
                <MiniBoard board={buildPreviewBoard(course)} />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{courseType}</p>
                      <h3 className="mt-2 truncate text-lg font-semibold text-white">{course.name}</h3>
                    </div>
                    <span className="rounded-full bg-black/25 px-2 py-1 text-[11px] capitalize text-zinc-300">{course.repertoire}</span>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">{course.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded-full border border-white/10 px-2 py-1">{course.lines.length} lessons</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">{reviewedCount} touched</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">{course.level}</span>
                    {course.creator ? <span className="rounded-full border border-white/10 px-2 py-1">by {course.creator.name}</span> : null}
                    {course.isShared ? <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-violet-100">community</span> : null}
                  </div>

                  {sections.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {sections.slice(0, 3).map((section) => (
                        <span key={section} className="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-zinc-300">
                          {section}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectCourse(course.id);
                      }}
                      className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                    >
                      Open
                    </button>
                    {resumeEntry ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onResume?.(course.id, resumeEntry.line_id);
                        }}
                        className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
                      >
                        Resume
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function inferCourseType(course: OpeningCourse): string {
  return /endgame|mate|lucena|philidor|opposition|pawn/.test(`${course.name} ${course.description}`.toLowerCase()) ? "Endgames" : "Openings";
}

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

function MiniBoard({ board }: { board: Board }) {
  return (
    <div className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-lg border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      {board.map((rank, rankIndex) =>
        rank.map((piece, fileIndex) => {
          const isLight = (fileIndex + rankIndex) % 2 === 0;

          return (
            <div
              key={`${fileIndex}-${rankIndex}`}
              className={[
                "grid aspect-square place-items-center select-none text-[14px] font-bold leading-none sm:text-[16px]",
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
    castlingRights = getUpdatedCastlingRights(previousBoard, parsedMove.from, parsedMove.to, previousCastlingRights);
    enPassantTarget = getNextEnPassantTarget(previousBoard, parsedMove.from, parsedMove.to);
  }

  return board;
}
