import "server-only";

import { spawn } from "child_process";
import { getNextEnPassantTarget, getUpdatedCastlingRights, makeMove, parseFen, parseUciMove } from "@/lib/chess";
import type { CastlingRights, PieceColor, Square } from "@/types/chess";

export type EngineSuggestion = {
  multipv: number;
  uci: string;
  san: string;
  evaluation: {
    type: "cp" | "mate";
    value: number;
    label: string;
  };
  pv: string[];
};

export type EngineAnalysisResult = {
  fen: string;
  depth: number;
  suggestions: EngineSuggestion[];
};

type UciLine = {
  multipv: number;
  uci: string;
  evaluation: {
    type: "cp" | "mate";
    value: number;
  };
  pv: string[];
};

const defaultDepth = 14;
const defaultMultiPv = 3;

export function getStockfishPath() {
  return process.env.STOCKFISH_PATH?.trim() || "";
}

export function isStockfishConfigured() {
  return Boolean(getStockfishPath());
}

export async function analyzePositionWithStockfish(fen: string, options?: { depth?: number; multiPv?: number }): Promise<EngineAnalysisResult> {
  const stockfishPath = getStockfishPath();

  if (!stockfishPath) {
    throw new Error("Stockfish is not configured on the server. Set STOCKFISH_PATH to your Stockfish binary.");
  }

  const depth = clampInteger(options?.depth ?? defaultDepth, 8, 24);
  const multiPv = clampInteger(options?.multiPv ?? defaultMultiPv, 1, 5);
  const engineLines = await runStockfish(stockfishPath, fen, depth, multiPv);

  return {
    fen,
    depth,
    suggestions: engineLines.map((line) => ({
      multipv: line.multipv,
      uci: line.uci,
      san: convertUciToSan(fen, line.uci) ?? line.uci,
      evaluation: {
        ...line.evaluation,
        label: formatEvaluation(line.evaluation.type, line.evaluation.value)
      },
      pv: convertPrincipalVariationToSan(fen, line.pv)
    }))
  };
}

function runStockfish(stockfishPath: string, fen: string, depth: number, multiPv: number): Promise<UciLine[]> {
  return new Promise((resolve, reject) => {
    const engine = spawn(stockfishPath, [], { stdio: "pipe", windowsHide: true });
    const timeout = setTimeout(() => {
      engine.kill();
      reject(new Error("Stockfish analysis timed out."));
    }, 15000);

    const linesByPv = new Map<number, UciLine>();
    let buffer = "";
    let hasResolved = false;

    const fail = (error: Error) => {
      if (hasResolved) {
        return;
      }

      hasResolved = true;
      clearTimeout(timeout);
      try {
        engine.kill();
      } catch {
        // Ignore process cleanup errors.
      }
      reject(error);
    };

    engine.once("error", (error) => fail(new Error(`Could not start Stockfish: ${error.message}`)));

    engine.stdout.on("data", (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const rawLines = buffer.split(/\r?\n/);
      buffer = rawLines.pop() ?? "";

      for (const rawLine of rawLines) {
        const line = rawLine.trim();

        if (!line) {
          continue;
        }

        if (line.startsWith("info ") && line.includes(" pv ") && line.includes(" score ")) {
          const parsed = parseInfoLine(line);

          if (parsed) {
            linesByPv.set(parsed.multipv, parsed);
          }
        }

        if (line.startsWith("bestmove ")) {
          if (hasResolved) {
            return;
          }

          hasResolved = true;
          clearTimeout(timeout);
          try {
            engine.kill();
          } catch {
            // Ignore process cleanup errors.
          }

          const suggestions = Array.from(linesByPv.values())
            .sort((left, right) => left.multipv - right.multipv)
            .filter((entry) => entry.uci.length >= 4)
            .slice(0, multiPv);

          resolve(suggestions);
        }
      }
    });

    engine.stderr.on("data", (chunk: Buffer | string) => {
      const message = chunk.toString().trim();

      if (message) {
        fail(new Error(`Stockfish error: ${message}`));
      }
    });

    const commands = [
      "uci",
      `setoption name MultiPV value ${multiPv}`,
      `setoption name Threads value ${clampInteger(Number(process.env.STOCKFISH_THREADS ?? 1), 1, 8)}`,
      `setoption name Hash value ${clampInteger(Number(process.env.STOCKFISH_HASH_MB ?? 32), 1, 512)}`,
      "isready",
      `position fen ${fen}`,
      `go depth ${depth}`
    ];

    for (const command of commands) {
      engine.stdin.write(`${command}\n`);
    }
  });
}

function parseInfoLine(line: string): UciLine | null {
  const multiPvMatch = line.match(/\bmultipv\s+(\d+)/);
  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  const pvMatch = line.match(/\bpv\s+(.+)$/);

  if (!scoreMatch || !pvMatch) {
    return null;
  }

  const pvMoves = pvMatch[1].trim().split(/\s+/).filter(Boolean);
  const firstMove = pvMoves[0];

  if (!firstMove) {
    return null;
  }

  return {
    multipv: multiPvMatch ? Number(multiPvMatch[1]) : 1,
    uci: firstMove,
    evaluation: {
      type: scoreMatch[1] as "cp" | "mate",
      value: Number(scoreMatch[2])
    },
    pv: pvMoves.slice(0, 8)
  };
}

function convertUciToSan(fen: string, uci: string): string | null {
  try {
    const parsed = parseFen(fen);
    const move = parseUciMove(uci);
    const result = makeMove(parsed.board, move.from, move.to, {
      promotion: move.promotion,
      castlingRights: parsed.castlingRights,
      enPassantTarget: parsed.enPassantTarget
    });

    return result?.move.notation ?? null;
  } catch {
    return null;
  }
}

function convertPrincipalVariationToSan(fen: string, pvMoves: string[]): string[] {
  try {
    const parsed = parseFen(fen);
    let board = parsed.board;
    let turn: PieceColor = parsed.turn;
    let castlingRights: CastlingRights = parsed.castlingRights;
    let enPassantTarget: Square | null = parsed.enPassantTarget;
    const sanMoves: string[] = [];

    for (const uci of pvMoves) {
      const move = parseUciMove(uci);
      const result = makeMove(board, move.from, move.to, {
        promotion: move.promotion,
        castlingRights,
        enPassantTarget
      });

      if (!result) {
        break;
      }

      sanMoves.push(result.move.notation);
      const previousBoard = board;
      const previousRights = castlingRights;
      board = result.board;
      castlingRights = getUpdatedCastlingRights(previousBoard, move.from, move.to, previousRights);
      enPassantTarget = getNextEnPassantTarget(previousBoard, move.from, move.to);
      turn = turn === "white" ? "black" : "white";
    }

    return sanMoves;
  } catch {
    return pvMoves;
  }
}

function formatEvaluation(type: "cp" | "mate", value: number): string {
  if (type === "mate") {
    return value > 0 ? `#${value}` : `#-${Math.abs(value)}`;
  }

  const pawns = value / 100;
  const prefix = pawns > 0 ? "+" : "";
  return `${prefix}${pawns.toFixed(1)}`;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
