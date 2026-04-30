import type { ChessComGame } from "@/lib/chesscom";

type LichessPlayerNode = {
  user?: {
    id?: string;
    name?: string;
  };
  userId?: string;
  name?: string;
  rating?: number;
};

type LichessGame = {
  id?: string;
  url?: string;
  pgn?: string;
  perf?: string;
  speed?: string;
  variant?: string;
  winner?: "white" | "black";
  createdAt?: number;
  lastMoveAt?: number;
  players?: {
    white?: LichessPlayerNode;
    black?: LichessPlayerNode;
  };
};

export async function fetchRecentLichessGames(username: string, limit = 100): Promise<ChessComGame[]> {
  const normalizedUsername = username.trim();

  if (!normalizedUsername) {
    return [];
  }

  const url = new URL(`https://lichess.org/api/games/user/${encodeURIComponent(normalizedUsername)}`);
  url.searchParams.set("max", String(limit));
  url.searchParams.set("moves", "true");
  url.searchParams.set("opening", "true");
  url.searchParams.set("pgnInJson", "true");
  url.searchParams.set("finished", "true");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/x-ndjson"
    }
  });

  if (!response.ok) {
    throw new Error("Could not fetch Lichess games for that username.");
  }

  const text = await response.text();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as LichessGame;
      } catch {
        return null;
      }
    })
    .filter((game): game is LichessGame => Boolean(game))
    .filter((game) => (game.variant ?? "standard") === "standard")
    .map((game) => convertLichessGame(game))
    .slice(0, limit);
}

function convertLichessGame(game: LichessGame): ChessComGame {
  const whiteUsername = readLichessUsername(game.players?.white);
  const blackUsername = readLichessUsername(game.players?.black);
  const winner = game.winner;
  const isDraw = !winner;

  return {
    url: game.url ?? (game.id ? `https://lichess.org/${game.id}` : undefined),
    pgn: game.pgn,
    time_class: normalizeLichessTimeClass(game.perf ?? game.speed),
    end_time: typeof game.lastMoveAt === "number" ? Math.floor(game.lastMoveAt / 1000) : typeof game.createdAt === "number" ? Math.floor(game.createdAt / 1000) : undefined,
    rules: "chess",
    white: {
      username: whiteUsername,
      rating: game.players?.white?.rating,
      result: isDraw ? "agreed" : winner === "white" ? "win" : "loss"
    },
    black: {
      username: blackUsername,
      rating: game.players?.black?.rating,
      result: isDraw ? "agreed" : winner === "black" ? "win" : "loss"
    }
  };
}

function readLichessUsername(player?: LichessPlayerNode) {
  return player?.user?.name ?? player?.user?.id ?? player?.userId ?? player?.name;
}

function normalizeLichessTimeClass(value?: string) {
  if (!value) {
    return "rapid";
  }

  const normalized = value.toLowerCase();

  if (normalized.includes("bullet")) {
    return "bullet";
  }

  if (normalized.includes("blitz")) {
    return "blitz";
  }

  if (normalized.includes("rapid")) {
    return "rapid";
  }

  if (normalized.includes("classical")) {
    return "classical";
  }

  return normalized;
}
