"use client";

import { BoardSquare } from "@/components/BoardSquare";
import { BoardAnnotationsOverlay, type BoardAnnotations } from "@/components/BoardAnnotations";
import { getLegalMoves, getPiece, sameSquare } from "@/lib/chess";
import type { Board, CastlingRights, GameStatus, PieceColor, Square } from "@/types/chess";

type ChessboardProps = {
  board: Board;
  turn: PieceColor;
  orientation: PieceColor;
  theme?: {
    light: string;
    dark: string;
  };
  annotations?: BoardAnnotations;
  selectedSquare: Square | null;
  legalMoves: Square[];
  gameStatus: GameStatus;
  hintedSquare?: Square | null;
  revealedSquare?: Square | null;
  computerSquare?: Square | null;
  computerTargetSquare?: Square | null;
  mistakenSquare?: Square | null;
  correctSquare?: Square | null;
  onSquareClick: (square: Square) => void;
};

export function Chessboard({
  board,
  turn,
  orientation,
  theme = { light: "#c8d7a6", dark: "#58745a" },
  annotations,
  selectedSquare,
  legalMoves,
  gameStatus,
  hintedSquare = null,
  revealedSquare = null,
  computerSquare = null,
  computerTargetSquare = null,
  mistakenSquare = null,
  correctSquare = null,
  onSquareClick
}: ChessboardProps) {
  const statusText = gameStatus === "playing" ? `${turn} to move` : gameStatus === "check" ? `${turn} in check` : gameStatus;
  const displayedRanks = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const displayedFiles = orientation === "white" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const matedKingSquare = gameStatus === "checkmate" ? findKingSquare(board, turn) : null;

  return (
    <div className="w-full max-w-[min(78vh,680px)]">
      <div className="mb-3 flex items-center justify-between text-sm text-zinc-300">
        <span className="font-medium text-zinc-100">Training board</span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 capitalize">{statusText}</span>
      </div>
      <div className="relative grid aspect-square w-full grid-cols-8 overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-glow">
        {displayedRanks.map((rankIndex, displayRankIndex) =>
          displayedFiles.map((fileIndex, displayFileIndex) => {
            const square = { file: fileIndex, rank: rankIndex };
            const piece = board[rankIndex][fileIndex];

            return (
              <BoardSquare
                key={`${fileIndex}-${rankIndex}`}
                square={square}
                piece={piece}
                theme={theme}
                isSelected={Boolean(selectedSquare && sameSquare(selectedSquare, square))}
                isLegalMove={legalMoves.some((move) => sameSquare(move, square))}
                isMatedKing={Boolean(matedKingSquare && sameSquare(matedKingSquare, square))}
                highlight={
                  revealedSquare && sameSquare(revealedSquare, square)
                    ? "reveal"
                    : computerSquare && sameSquare(computerSquare, square)
                      ? "computer"
                      : computerTargetSquare && sameSquare(computerTargetSquare, square)
                        ? "computer-target"
                      : correctSquare && sameSquare(correctSquare, square)
                      ? "correct"
                    : mistakenSquare && sameSquare(mistakenSquare, square)
                      ? "mistake"
                    : hintedSquare && sameSquare(hintedSquare, square)
                      ? "hint"
                      : null
                }
                rankLabel={`${8 - rankIndex}`}
                fileLabel={String.fromCharCode(97 + fileIndex)}
                showRankLabel={displayFileIndex === 0}
                showFileLabel={displayRankIndex === 7}
                onClick={onSquareClick}
              />
            );
          })
        )}
        <BoardAnnotationsOverlay annotations={annotations} orientation={orientation} />
      </div>
    </div>
  );
}

function findKingSquare(board: Board, color: PieceColor): Square | null {
  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    for (let fileIndex = 0; fileIndex < board[rankIndex].length; fileIndex += 1) {
      const piece = board[rankIndex][fileIndex];

      if (piece?.type === "king" && piece.color === color) {
        return { file: fileIndex, rank: rankIndex };
      }
    }
  }

  return null;
}

export function getSelectableMoves(board: Board, square: Square, turn: PieceColor, castlingRights?: CastlingRights, enPassantTarget: Square | null = null): Square[] {
  const piece = getPiece(board, square);

  if (!piece || piece.color !== turn) {
    return [];
  }

  return getLegalMoves(board, square, castlingRights, enPassantTarget);
}
