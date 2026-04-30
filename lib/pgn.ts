import type { OpeningCourse, TrainingMove } from "@/lib/courses";
import { boardToFen, getLegalMoves, getNextEnPassantTarget, getUpdatedCastlingRights, makeMove, moveToUci, oppositeColor, parseFen, startingFen } from "@/lib/chess";
import type { Board, CastlingRights, ChessPiece, PieceColor, PieceType, Square } from "@/types/chess";

export type ParsedSanMove = {
  san: string;
  uci: string;
};

export type ParsedSanLine = {
  moves: ParsedSanMove[];
  positions: Array<{ fen: string }>;
};

type BuildPgnCourseOptions = {
  pgn: string;
  courseName: string;
  sideToTrain: PieceColor;
};

const pieceSanToType: Record<string, PieceType> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight"
};

export function buildCourseFromPgn({ pgn, courseName, sideToTrain }: BuildPgnCourseOptions): OpeningCourse | null {
  const sanMoves = tokenizePgn(pgn);

  if (sanMoves.length < 2) {
    return null;
  }

  const parsed = parseSanMoves(sanMoves);

  if (parsed.moves.length === 0) {
    return null;
  }

  const startIndex = sideToTrain === "white" ? 0 : 1;
  const fen = sideToTrain === "white" ? startingFen : parsed.positions[1]?.fen;

  if (!fen) {
    return null;
  }

  const trainingMoves: TrainingMove[] = [];

  for (let index = startIndex; index < parsed.moves.length; index += 2) {
    const move = parsed.moves[index];
    const reply = parsed.moves[index + 1];

    if (!move) {
      continue;
    }

    trainingMoves.push({
      uci: move.uci,
      san: sideToTrain === "black" ? `...${move.san}` : move.san,
      prompt: makePrompt(move.san, sideToTrain, trainingMoves.length),
      explanation: "Imported from your PGN. Add a short note here later about why this move matters in your repertoire.",
      plan: "Replay the line until the move feels automatic, then add a practical plan in the course data.",
      opponentReply: reply
        ? {
            uci: reply.uci,
            san: sideToTrain === "white" ? `...${reply.san}` : reply.san
          }
        : undefined
    });
  }

  if (trainingMoves.length === 0) {
    return null;
  }

  const id = `imported-${slugify(courseName)}-${Date.now()}`;

  return {
    id,
    name: courseName.trim() || "Imported PGN Course",
    repertoire: sideToTrain,
    level: "Imported",
    description: "A PGN-based course generated locally from your opening line.",
    lines: [
      {
        id: `${id}-main-line`,
        name: "Imported main line",
        analysisTags: buildAnalysisTags(courseName, sanMoves),
        fen,
        sideToTrain,
        dueLevel: "new",
        moves: trainingMoves
      }
    ]
  };
}

export function tokenizePgn(pgn: string): string[] {
  return pgn
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\d+\.(\.\.)?/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !["1-0", "0-1", "1/2-1/2", "*"].includes(token))
    .map((token) => token.replace(/^\d+\.\.\./, ""));
}

export function parseSanLine(sanMoves: string[]): ParsedSanLine {
  return parseSanMoves(sanMoves);
}

function parseSanMoves(sanMoves: string[]): ParsedSanLine {
  let { board, turn, castlingRights, enPassantTarget } = parseFen(startingFen);
  const moves: ParsedSanMove[] = [];
  const positions: Array<{ fen: string }> = [{ fen: startingFen }];

  for (const san of sanMoves) {
    const resolved = resolveSanMove(board, turn, castlingRights, enPassantTarget, san);

    if (!resolved) {
      break;
    }

    const result = makeMove(board, resolved.from, resolved.to, { promotion: resolved.promotion, castlingRights, enPassantTarget });

    if (!result) {
      break;
    }

    const uci = moveToUci(resolved.from, resolved.to, resolved.promotion);
    castlingRights = getUpdatedCastlingRights(board, resolved.from, resolved.to, castlingRights);
    enPassantTarget = getNextEnPassantTarget(board, resolved.from, resolved.to);
    board = result.board;
    turn = oppositeColor(turn);
    moves.push({ san: cleanSan(san), uci });
    positions.push({ fen: boardToFen(board, turn, castlingRights, enPassantTarget) });
  }

  return { moves, positions };
}

function resolveSanMove(board: Board, turn: PieceColor, castlingRights: CastlingRights, enPassantTarget: Square | null, san: string): { from: Square; to: Square; promotion?: PieceType } | null {
  const cleaned = cleanSan(san);

  if (cleaned === "O-O" || cleaned === "O-O-O") {
    const rank = turn === "white" ? 7 : 0;
    const from = { file: 4, rank };
    const to = { file: cleaned === "O-O" ? 6 : 2, rank };

    return getLegalMoves(board, from, castlingRights, enPassantTarget).some((move) => move.file === to.file && move.rank === to.rank) ? { from, to } : null;
  }

  const targetMatch = cleaned.match(/[a-h][1-8](?:=[QRBN])?$/);

  if (!targetMatch) {
    return null;
  }

  const targetText = targetMatch[0].slice(0, 2);
  const target = algebraicTarget(targetText);
  const promotion = parsePromotion(cleaned);
  const first = cleaned[0];
  const pieceType = pieceSanToType[first] ?? "pawn";
  const detail = cleaned
    .replace(/[+#]/g, "")
    .replace(/x/g, "")
    .replace(/=[QRBN]$/, "")
    .replace(targetText, "")
    .replace(/^[KQRBN]/, "");

  const candidates = collectPieces(board, turn, pieceType).filter(({ square, piece }) => {
    if (!matchesDisambiguation(square, detail, piece)) {
      return false;
    }

    return getLegalMoves(board, square, castlingRights, enPassantTarget).some((move) => move.file === target.file && move.rank === target.rank);
  });

  if (candidates.length !== 1) {
    return null;
  }

  return { from: candidates[0].square, to: target, promotion };
}

function collectPieces(board: Board, color: PieceColor, type: PieceType): Array<{ square: Square; piece: ChessPiece }> {
  const pieces: Array<{ square: Square; piece: ChessPiece }> = [];

  board.forEach((rank, rankIndex) => {
    rank.forEach((piece, fileIndex) => {
      if (piece?.color === color && piece.type === type) {
        pieces.push({ square: { file: fileIndex, rank: rankIndex }, piece });
      }
    });
  });

  return pieces;
}

function matchesDisambiguation(square: Square, detail: string, piece: ChessPiece): boolean {
  if (!detail) {
    return true;
  }

  if (piece.type === "pawn" && /^[a-h]$/.test(detail)) {
    return square.file === detail.charCodeAt(0) - 97;
  }

  return detail.split("").every((token) => {
    if (/[a-h]/.test(token)) {
      return square.file === token.charCodeAt(0) - 97;
    }

    if (/[1-8]/.test(token)) {
      return square.rank === 8 - Number(token);
    }

    return true;
  });
}

function algebraicTarget(value: string): Square {
  return {
    file: value.charCodeAt(0) - 97,
    rank: 8 - Number(value[1])
  };
}

function cleanSan(san: string): string {
  return san.replace(/[!?]+/g, "").replace(/[+#]+$/g, "");
}

function parsePromotion(san: string): PieceType | undefined {
  const match = san.match(/=([QRBN])/);

  if (!match) {
    return undefined;
  }

  return pieceSanToType[match[1]];
}

function makePrompt(san: string, sideToTrain: PieceColor, moveNumber: number): string {
  const side = sideToTrain === "white" ? "White" : "Black";

  return `${side} to move in your imported line. What is move ${moveNumber + 1}?`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function buildAnalysisTags(name: string, sanMoves: string[]): string[] {
  const tags = new Set<string>();
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName) {
    tags.add(normalizedName);
  }

  const firstMoves = sanMoves.slice(0, 8);

  if (firstMoves.length) {
    tags.add(firstMoves.join(" ").toLowerCase());
  }

  for (const move of firstMoves) {
    const cleaned = move.toLowerCase().replace(/[!?+#]/g, "").trim();

    if (cleaned) {
      tags.add(cleaned);
    }
  }

  return Array.from(tags);
}
