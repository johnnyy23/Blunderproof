"use client";

import type { OpeningCourse } from "@/lib/courses";
import { getNextEnPassantTarget, getUpdatedCastlingRights, makeMove, parseFen, parseUciMove } from "@/lib/chess";
import type { Board, CastlingRights, ChessPiece, PieceColor, Square } from "@/types/chess";

type CommunityCourseShelfProps = {
  courses: OpeningCourse[];
  onOpenCourse: (courseId: string) => void;
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

export function CommunityCourseShelf({ courses, onOpenCourse }: CommunityCourseShelfProps) {
  if (!courses.length) {
    return null;
  }

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Community courses</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Shared lines from the community</h2>
        <p className="mt-2 text-sm text-zinc-400">Your main Blounderproof courses stay on top. Community creations live here underneath for extra ideas and traps.</p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {courses.map((course) => (
          <button
            key={course.id}
            type="button"
            onClick={() => onOpenCourse(course.id)}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-violet-300/25 hover:bg-white/[0.05]"
          >
            <div className="grid gap-4 md:grid-cols-[196px_minmax(0,1fr)]">
              <MiniBoard board={buildPreviewBoard(course)} />

              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">Community</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{course.name}</h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[11px] font-semibold text-violet-100">
                    {course.repertoire}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-7 text-zinc-400">{course.description}</p>

                <p className="mt-3 text-sm italic text-zinc-500">
                  by {course.creator?.name ?? "Anonymous"}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                  <span className="rounded-full border border-white/10 px-2 py-1">{course.lines.length} lines total</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">{course.engagement?.likes ?? 0} likes</span>
                  <span className="rounded-full border border-white/10 px-2 py-1">{(course.engagement?.rating ?? 0).toFixed(1)} rating</span>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold text-zinc-200">Try the first line -&gt;</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-zinc-200">
                    {"\u2665"} {course.engagement?.likes ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

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
                "grid aspect-square place-items-center select-none text-[16px] font-bold leading-none md:text-[20px]",
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
