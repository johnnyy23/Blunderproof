import type { Board, CastlingRights, ChessMove, ChessPiece, GameStatus, MoveOptions, ParsedFen, PieceColor, PieceType, Square } from "@/types/chess";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

const fenPieceMap: Record<string, ChessPiece> = {
  p: { type: "pawn", color: "black" },
  n: { type: "knight", color: "black" },
  b: { type: "bishop", color: "black" },
  r: { type: "rook", color: "black" },
  q: { type: "queen", color: "black" },
  k: { type: "king", color: "black" },
  P: { type: "pawn", color: "white" },
  N: { type: "knight", color: "white" },
  B: { type: "bishop", color: "white" },
  R: { type: "rook", color: "white" },
  Q: { type: "queen", color: "white" },
  K: { type: "king", color: "white" }
};

const pieceLetter: Record<PieceType, string> = {
  pawn: "",
  knight: "N",
  bishop: "B",
  rook: "R",
  queen: "Q",
  king: "K"
};

export const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function createEmptyBoard(): Board {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

export function parseFen(fen: string): ParsedFen {
  const [placement, activeColor = "w", castling = "-", enPassant = "-"] = fen.trim().split(/\s+/);
  const ranks = placement.split("/");

  if (ranks.length !== 8) {
    throw new Error("FEN must contain 8 ranks.");
  }

  const board = createEmptyBoard();

  ranks.forEach((rankText, rowIndex) => {
    let fileIndex = 0;

    for (const token of rankText) {
      const emptyCount = Number(token);

      if (Number.isInteger(emptyCount) && emptyCount > 0) {
        fileIndex += emptyCount;
        continue;
      }

      const piece = fenPieceMap[token];
      if (!piece || fileIndex > 7) {
        throw new Error(`Invalid FEN token: ${token}`);
      }

      board[rowIndex][fileIndex] = { ...piece };
      fileIndex += 1;
    }

    if (fileIndex !== 8) {
      throw new Error("Every FEN rank must contain 8 files.");
    }
  });

  return {
    board,
    turn: activeColor === "b" ? "black" : "white",
    castlingRights: parseCastlingRights(castling),
    enPassantTarget: enPassant === "-" ? null : algebraicToSquare(enPassant)
  };
}

export function boardToFen(board: Board, turn: PieceColor, castlingRights: CastlingRights = emptyCastlingRights(), enPassantTarget: Square | null = null): string {
  const placement = board
    .map((rank) => {
      let emptyCount = 0;
      let text = "";

      for (const piece of rank) {
        if (!piece) {
          emptyCount += 1;
          continue;
        }

        if (emptyCount > 0) {
          text += String(emptyCount);
          emptyCount = 0;
        }

        text += pieceToFenToken(piece);
      }

      return text + (emptyCount > 0 ? String(emptyCount) : "");
    })
    .join("/");

  return `${placement} ${turn === "white" ? "w" : "b"} ${formatCastlingRights(castlingRights)} ${enPassantTarget ? squareToAlgebraic(enPassantTarget) : "-"} 0 1`;
}

export function squareToAlgebraic(square: Square): string {
  return `${files[square.file]}${8 - square.rank}`;
}

export function algebraicToSquare(value: string): Square {
  const file = files.indexOf(value[0]);
  const rank = 8 - Number(value[1]);

  if (file < 0 || rank < 0 || rank > 7) {
    throw new Error(`Invalid square: ${value}`);
  }

  return { file, rank };
}

export function sameSquare(a: Square, b: Square): boolean {
  return a.file === b.file && a.rank === b.rank;
}

export function isInsideBoard(square: Square): boolean {
  return square.file >= 0 && square.file < 8 && square.rank >= 0 && square.rank < 8;
}

export function getPiece(board: Board, square: Square): ChessPiece | null {
  if (!isInsideBoard(square)) {
    return null;
  }

  return board[square.rank][square.file];
}

export function cloneBoard(board: Board): Board {
  return board.map((rank) => rank.map((piece) => (piece ? { ...piece } : null)));
}

export function oppositeColor(color: PieceColor): PieceColor {
  return color === "white" ? "black" : "white";
}

export function moveToUci(from: Square, to: Square, promotion?: PieceType): string {
  return `${squareToAlgebraic(from)}${squareToAlgebraic(to)}${promotion ? promotionToUci(promotion) : ""}`;
}

export function parseUciMove(uci: string): { from: Square; to: Square; promotion?: PieceType } {
  const promotion = uci[4] ? uciPromotionToPiece(uci[4]) : undefined;

  return {
    from: algebraicToSquare(uci.slice(0, 2)),
    to: algebraicToSquare(uci.slice(2, 4)),
    promotion
  };
}

export function makeMove(board: Board, from: Square, to: Square, options: MoveOptions = {}): { board: Board; move: ChessMove } | null {
  const piece = getPiece(board, from);

  if (!piece) {
    return null;
  }

  const nextBoard = cloneBoard(board);
  const captured = getPiece(nextBoard, to);
  const isCastle = piece.type === "king" && Math.abs(to.file - from.file) === 2;
  const isEnPassant = piece.type === "pawn" && !captured && options.enPassantTarget && sameSquare(to, options.enPassantTarget) && from.file !== to.file;
  const capturedPiece = isEnPassant ? getPiece(nextBoard, { file: to.file, rank: from.rank }) : captured;
  const promotion = piece.type === "pawn" && (to.rank === 0 || to.rank === 7) ? options.promotion ?? "queen" : undefined;
  const movedPiece = promotion ? { ...piece, type: promotion } : { ...piece };

  nextBoard[to.rank][to.file] = movedPiece;
  nextBoard[from.rank][from.file] = null;

  if (isEnPassant) {
    nextBoard[from.rank][to.file] = null;
  }

  if (isCastle) {
    moveCastlingRook(nextBoard, from, to);
  }

  const notation = formatMoveNotation(piece, from, to, capturedPiece, promotion, isCastle, Boolean(isEnPassant));

  return {
    board: nextBoard,
    move: {
      from,
      to,
      piece,
      captured: capturedPiece,
      promotion,
      isCastle,
      isEnPassant: Boolean(isEnPassant),
      notation
    }
  };
}

export function getNextEnPassantTarget(board: Board, from: Square, to: Square): Square | null {
  const piece = getPiece(board, from);

  if (piece?.type !== "pawn" || Math.abs(to.rank - from.rank) !== 2) {
    return null;
  }

  return {
    file: from.file,
    rank: (from.rank + to.rank) / 2
  };
}

export function getUpdatedCastlingRights(board: Board, from: Square, to: Square, rights: CastlingRights): CastlingRights {
  const piece = getPiece(board, from);
  const captured = getPiece(board, to);
  const nextRights = { ...rights };

  if (piece?.type === "king") {
    if (piece.color === "white") {
      nextRights.whiteKingSide = false;
      nextRights.whiteQueenSide = false;
    } else {
      nextRights.blackKingSide = false;
      nextRights.blackQueenSide = false;
    }
  }

  if (piece?.type === "rook") {
    clearRookCastlingRight(nextRights, piece.color, from);
  }

  if (captured?.type === "rook") {
    clearRookCastlingRight(nextRights, captured.color, to);
  }

  return nextRights;
}

export function getLegalMoves(board: Board, from: Square, castlingRights: CastlingRights = inferCastlingRights(board), enPassantTarget: Square | null = null): Square[] {
  return getPseudoLegalMoves(board, from, { includeCastling: true, castlingRights, enPassantTarget }).filter((to) => {
    const result = makeMove(board, from, to, { castlingRights, enPassantTarget });
    const piece = getPiece(board, from);

    return Boolean(piece && result && !isKingInCheck(result.board, piece.color));
  });
}

export function getGameStatus(board: Board, turn: PieceColor, castlingRights: CastlingRights = inferCastlingRights(board), enPassantTarget: Square | null = null): GameStatus {
  const hasLegalMove = board.some((rank, rankIndex) =>
    rank.some((piece, fileIndex) => piece?.color === turn && getLegalMoves(board, { file: fileIndex, rank: rankIndex }, castlingRights, enPassantTarget).length > 0)
  );
  const inCheck = isKingInCheck(board, turn);

  if (hasLegalMove) {
    return inCheck ? "check" : "playing";
  }

  return inCheck ? "checkmate" : "stalemate";
}

export function isKingInCheck(board: Board, color: PieceColor): boolean {
  const kingSquare = findKing(board, color);

  if (!kingSquare) {
    return false;
  }

  return isSquareAttacked(board, kingSquare, oppositeColor(color));
}

export function isSquareAttacked(board: Board, square: Square, byColor: PieceColor): boolean {
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const from = { file, rank };
      const piece = getPiece(board, from);

      if (!piece || piece.color !== byColor) {
        continue;
      }

      if (getAttackSquares(board, from, piece).some((attack) => sameSquare(attack, square))) {
        return true;
      }
    }
  }

  return false;
}

function getPseudoLegalMoves(board: Board, from: Square, options: { includeCastling: boolean; castlingRights?: CastlingRights; enPassantTarget?: Square | null }): Square[] {
  const piece = getPiece(board, from);

  if (!piece) {
    return [];
  }

  switch (piece.type) {
    case "pawn":
      return getPawnMoves(board, from, piece.color, options.enPassantTarget ?? null);
    case "knight":
      return getJumpMoves(board, from, piece.color, [
        [1, 2],
        [2, 1],
        [2, -1],
        [1, -2],
        [-1, -2],
        [-2, -1],
        [-2, 1],
        [-1, 2]
      ]);
    case "bishop":
      return getSlidingMoves(board, from, piece.color, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ]);
    case "rook":
      return getSlidingMoves(board, from, piece.color, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]);
    case "queen":
      return getSlidingMoves(board, from, piece.color, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ]);
    case "king":
      return [
        ...getJumpMoves(board, from, piece.color, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
        ]),
        ...(options.includeCastling ? getCastlingMoves(board, from, piece.color, options.castlingRights ?? inferCastlingRights(board)) : [])
      ];
  }
}

function getPawnMoves(board: Board, from: Square, color: PieceColor, enPassantTarget: Square | null): Square[] {
  const direction = color === "white" ? -1 : 1;
  const startRank = color === "white" ? 6 : 1;
  const moves: Square[] = [];
  const oneForward = { file: from.file, rank: from.rank + direction };
  const twoForward = { file: from.file, rank: from.rank + direction * 2 };

  if (isInsideBoard(oneForward) && !getPiece(board, oneForward)) {
    moves.push(oneForward);

    if (from.rank === startRank && !getPiece(board, twoForward)) {
      moves.push(twoForward);
    }
  }

  for (const fileDelta of [-1, 1]) {
    const captureSquare = { file: from.file + fileDelta, rank: from.rank + direction };
    const target = getPiece(board, captureSquare);

    if (isInsideBoard(captureSquare) && target && target.color !== color) {
      moves.push(captureSquare);
    }

    if (enPassantTarget && sameSquare(captureSquare, enPassantTarget)) {
      const capturedPawnSquare = { file: captureSquare.file, rank: from.rank };
      const capturedPawn = getPiece(board, capturedPawnSquare);

      if (capturedPawn?.type === "pawn" && capturedPawn.color !== color) {
        moves.push(captureSquare);
      }
    }
  }

  return moves;
}

function getJumpMoves(board: Board, from: Square, color: PieceColor, deltas: number[][]): Square[] {
  return deltas
    .map(([fileDelta, rankDelta]) => ({ file: from.file + fileDelta, rank: from.rank + rankDelta }))
    .filter((square) => {
      const target = getPiece(board, square);
      return isInsideBoard(square) && (!target || target.color !== color);
    });
}

function getSlidingMoves(board: Board, from: Square, color: PieceColor, deltas: number[][]): Square[] {
  const moves: Square[] = [];

  for (const [fileDelta, rankDelta] of deltas) {
    let next = { file: from.file + fileDelta, rank: from.rank + rankDelta };

    while (isInsideBoard(next)) {
      const target = getPiece(board, next);

      if (!target) {
        moves.push(next);
      } else {
        if (target.color !== color) {
          moves.push(next);
        }
        break;
      }

      next = { file: next.file + fileDelta, rank: next.rank + rankDelta };
    }
  }

  return moves;
}

function getAttackSquares(board: Board, from: Square, piece: ChessPiece): Square[] {
  if (piece.type === "pawn") {
    const direction = piece.color === "white" ? -1 : 1;
    return [-1, 1]
      .map((fileDelta) => ({ file: from.file + fileDelta, rank: from.rank + direction }))
      .filter(isInsideBoard);
  }

  return getPseudoLegalMoves(board, from, { includeCastling: false });
}

function findKing(board: Board, color: PieceColor): Square | null {
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[rank][file];

      if (piece?.type === "king" && piece.color === color) {
        return { file, rank };
      }
    }
  }

  return null;
}

function getCastlingMoves(board: Board, from: Square, color: PieceColor, castlingRights: CastlingRights): Square[] {
  const homeRank = color === "white" ? 7 : 0;
  const moves: Square[] = [];

  if (from.rank !== homeRank || from.file !== 4 || isKingInCheck(board, color)) {
    return moves;
  }

  if (hasCastlingRight(castlingRights, color, "king") && canCastle(board, color, "king")) {
    moves.push({ file: 6, rank: homeRank });
  }

  if (hasCastlingRight(castlingRights, color, "queen") && canCastle(board, color, "queen")) {
    moves.push({ file: 2, rank: homeRank });
  }

  return moves;
}

function canCastle(board: Board, color: PieceColor, side: "king" | "queen"): boolean {
  const rank = color === "white" ? 7 : 0;
  const rookFile = side === "king" ? 7 : 0;
  const emptyFiles = side === "king" ? [5, 6] : [1, 2, 3];
  const safeFiles = side === "king" ? [5, 6] : [3, 2];
  const king = getPiece(board, { file: 4, rank });
  const rook = getPiece(board, { file: rookFile, rank });

  if (king?.type !== "king" || king.color !== color || rook?.type !== "rook" || rook.color !== color) {
    return false;
  }

  if (emptyFiles.some((file) => getPiece(board, { file, rank }))) {
    return false;
  }

  return safeFiles.every((file) => !isSquareAttacked(board, { file, rank }, oppositeColor(color)));
}

function moveCastlingRook(board: Board, from: Square, to: Square): void {
  const isKingSide = to.file > from.file;
  const rookFrom = { file: isKingSide ? 7 : 0, rank: from.rank };
  const rookTo = { file: isKingSide ? 5 : 3, rank: from.rank };
  const rook = getPiece(board, rookFrom);

  board[rookTo.rank][rookTo.file] = rook ? { ...rook } : null;
  board[rookFrom.rank][rookFrom.file] = null;
}

function formatMoveNotation(piece: ChessPiece, from: Square, to: Square, captured?: ChessPiece | null, promotion?: PieceType, isCastle?: boolean, isEnPassant?: boolean): string {
  if (isCastle) {
    return to.file === 6 ? "O-O" : "O-O-O";
  }

  const target = squareToAlgebraic(to);
  const promotionText = promotion ? `=${pieceLetter[promotion]}` : "";

  if (piece.type === "pawn") {
    return captured || isEnPassant ? `${squareToAlgebraic(from)[0]}x${target}${promotionText}` : `${target}${promotionText}`;
  }

  return `${pieceLetter[piece.type]}${captured ? "x" : ""}${target}`;
}

function promotionToUci(promotion: PieceType): string {
  const promotionMap: Partial<Record<PieceType, string>> = {
    queen: "q",
    rook: "r",
    bishop: "b",
    knight: "n"
  };

  return promotionMap[promotion] ?? "";
}

function uciPromotionToPiece(value: string): PieceType | undefined {
  const promotionMap: Record<string, PieceType> = {
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight"
  };

  return promotionMap[value.toLowerCase()];
}

export function emptyCastlingRights(): CastlingRights {
  return {
    whiteKingSide: false,
    whiteQueenSide: false,
    blackKingSide: false,
    blackQueenSide: false
  };
}

function parseCastlingRights(value: string): CastlingRights {
  return {
    whiteKingSide: value.includes("K"),
    whiteQueenSide: value.includes("Q"),
    blackKingSide: value.includes("k"),
    blackQueenSide: value.includes("q")
  };
}

function formatCastlingRights(rights: CastlingRights): string {
  const text = `${rights.whiteKingSide ? "K" : ""}${rights.whiteQueenSide ? "Q" : ""}${rights.blackKingSide ? "k" : ""}${rights.blackQueenSide ? "q" : ""}`;

  return text || "-";
}

function inferCastlingRights(board: Board): CastlingRights {
  const whiteKing = getPiece(board, { file: 4, rank: 7 });
  const blackKing = getPiece(board, { file: 4, rank: 0 });
  const whiteKingRook = getPiece(board, { file: 7, rank: 7 });
  const whiteQueenRook = getPiece(board, { file: 0, rank: 7 });
  const blackKingRook = getPiece(board, { file: 7, rank: 0 });
  const blackQueenRook = getPiece(board, { file: 0, rank: 0 });

  return {
    whiteKingSide: Boolean(whiteKing?.type === "king" && whiteKing.color === "white" && whiteKingRook?.type === "rook" && whiteKingRook.color === "white"),
    whiteQueenSide: Boolean(whiteKing?.type === "king" && whiteKing.color === "white" && whiteQueenRook?.type === "rook" && whiteQueenRook.color === "white"),
    blackKingSide: Boolean(blackKing?.type === "king" && blackKing.color === "black" && blackKingRook?.type === "rook" && blackKingRook.color === "black"),
    blackQueenSide: Boolean(blackKing?.type === "king" && blackKing.color === "black" && blackQueenRook?.type === "rook" && blackQueenRook.color === "black")
  };
}

function hasCastlingRight(rights: CastlingRights, color: PieceColor, side: "king" | "queen"): boolean {
  if (color === "white") {
    return side === "king" ? rights.whiteKingSide : rights.whiteQueenSide;
  }

  return side === "king" ? rights.blackKingSide : rights.blackQueenSide;
}

function clearRookCastlingRight(rights: CastlingRights, color: PieceColor, square: Square): void {
  if (color === "white" && square.rank === 7 && square.file === 7) {
    rights.whiteKingSide = false;
  }

  if (color === "white" && square.rank === 7 && square.file === 0) {
    rights.whiteQueenSide = false;
  }

  if (color === "black" && square.rank === 0 && square.file === 7) {
    rights.blackKingSide = false;
  }

  if (color === "black" && square.rank === 0 && square.file === 0) {
    rights.blackQueenSide = false;
  }
}

function pieceToFenToken(piece: ChessPiece): string {
  const tokenByType: Record<PieceType, string> = {
    pawn: "p",
    knight: "n",
    bishop: "b",
    rook: "r",
    queen: "q",
    king: "k"
  };
  const token = tokenByType[piece.type];

  return piece.color === "white" ? token.toUpperCase() : token;
}
