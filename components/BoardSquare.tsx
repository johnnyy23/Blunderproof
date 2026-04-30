"use client";

import type { ChessPiece, Square } from "@/types/chess";

type BoardTheme = {
  light: string;
  dark: string;
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

type BoardSquareProps = {
  square: Square;
  piece: ChessPiece | null;
  isSelected: boolean;
  isLegalMove: boolean;
  isMatedKing: boolean;
  highlight: "hint" | "reveal" | "mistake" | "correct" | "computer" | "computer-target" | null;
  rankLabel: string;
  fileLabel: string;
  showRankLabel: boolean;
  showFileLabel: boolean;
  theme: BoardTheme;
  onClick: (square: Square) => void;
};

export function BoardSquare({
  square,
  piece,
  isSelected,
  isLegalMove,
  isMatedKing,
  highlight,
  rankLabel,
  fileLabel,
  showRankLabel,
  showFileLabel,
  theme,
  onClick
}: BoardSquareProps) {
  const isLight = (square.file + square.rank) % 2 === 0;
  const labelColor = isLight ? "text-zinc-700/45" : "text-zinc-100/45";
  const isComputerHighlightedPiece = highlight === "computer" || highlight === "computer-target";
  const pieceAccentClass =
    highlight === "computer-target"
      ? piece?.color === "white"
        ? "drop-shadow-[0_0_10px_rgba(254,240,138,0.95)] [text-shadow:0_1px_1px_rgba(0,0,0,0.55),0_0_16px_rgba(254,240,138,0.9)]"
        : "drop-shadow-[0_0_10px_rgba(253,224,71,0.95)] [text-shadow:0_0_14px_rgba(253,224,71,0.85)]"
      : highlight === "computer"
        ? piece?.color === "white"
          ? "drop-shadow-[0_0_8px_rgba(253,224,71,0.8)] [text-shadow:0_1px_1px_rgba(0,0,0,0.55),0_0_12px_rgba(253,224,71,0.75)]"
          : "drop-shadow-[0_0_8px_rgba(253,224,71,0.8)] [text-shadow:0_0_10px_rgba(253,224,71,0.7)]"
        : "";

  return (
    <button
      type="button"
      aria-label={`${String.fromCharCode(97 + square.file)}${8 - square.rank}`}
      onClick={() => onClick(square)}
      className={[
        "relative aspect-square min-w-0 select-none overflow-hidden transition",
        highlight === "hint" ? "before:absolute before:inset-0 before:bg-sky-400/22 ring-4 ring-sky-300 ring-inset" : "",
        highlight === "reveal" ? "before:absolute before:inset-0 before:bg-amber-300/28 ring-4 ring-amber-200 ring-inset" : "",
        highlight === "computer" ? "before:absolute before:inset-0 before:bg-yellow-300/40 ring-4 ring-yellow-300 ring-inset shadow-[inset_0_0_0_999px_rgba(253,224,71,0.10)]" : "",
        highlight === "computer-target" ? "before:absolute before:inset-0 before:bg-yellow-200/38 ring-4 ring-yellow-200 ring-inset shadow-[inset_0_0_0_999px_rgba(254,240,138,0.10)]" : "",
        highlight === "mistake" ? "before:absolute before:inset-0 before:bg-rose-500/28 ring-4 ring-rose-300 ring-inset" : "",
        highlight === "correct" ? "before:absolute before:inset-0 before:bg-emerald-400/20 ring-4 ring-emerald-300 ring-inset" : "",
        isMatedKing ? "before:absolute before:inset-0 before:bg-red-500/35" : "",
        isMatedKing ? "ring-4 ring-red-400 ring-inset" : "",
        isSelected ? "ring-4 ring-emerald-300 ring-inset" : "",
        isLegalMove ? "after:absolute after:left-1/2 after:top-1/2 after:h-4 after:w-4 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-emerald-200/80" : ""
      ].join(" ")}
      style={{ backgroundColor: isLight ? theme.light : theme.dark }}
    >
      <span className={`absolute left-1 top-0.5 text-[10px] font-bold ${labelColor}`}>
        {showRankLabel ? rankLabel : ""}
      </span>
      <span className={`absolute bottom-0.5 right-1 text-[10px] font-bold ${labelColor}`}>
        {showFileLabel ? fileLabel : ""}
      </span>
      {highlight === "mistake" ? (
        <span className="absolute right-1 top-1 z-20 grid h-7 w-7 place-items-center rounded-full bg-rose-500 text-sm font-black text-white shadow-[0_6px_18px_rgba(244,63,94,0.45)]">
          ×
        </span>
      ) : null}
      {highlight === "correct" ? (
        <span className="absolute right-1 top-1 z-20 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-sm font-black text-white shadow-[0_6px_18px_rgba(16,185,129,0.45)]">
          ✓
        </span>
      ) : null}
      {piece ? (
        <span
          className={[
            "piece relative z-10 grid h-full w-full place-items-center text-[clamp(2rem,7vw,4.3rem)] leading-none text-zinc-950 transition",
            isComputerHighlightedPiece ? "scale-[1.03]" : ""
          ].join(" ")}
        >
          <span
            className={[
              piece.color === "white" ? "text-zinc-50 [text-shadow:0_1px_1px_rgba(0,0,0,0.55)]" : "text-zinc-950",
              pieceAccentClass
            ].join(" ")}
          >
            {pieceGlyph[piece.color][piece.type]}
          </span>
        </span>
      ) : null}
    </button>
  );
}
