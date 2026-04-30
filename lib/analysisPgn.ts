import type { ChessComGame } from "@/lib/chesscom";

export function buildAnalysisGamesFromPgn(pgnText: string): ChessComGame[] {
  return splitPgnGames(pgnText)
    .map((pgn) => buildGameFromPgn(pgn))
    .filter((game): game is ChessComGame => Boolean(game));
}

function buildGameFromPgn(pgn: string): ChessComGame | null {
  const whiteUsername = readHeader(pgn, "White");
  const blackUsername = readHeader(pgn, "Black");
  const result = readHeader(pgn, "Result");

  if (!whiteUsername || !blackUsername || !result) {
    return null;
  }

  const whiteRating = parseNumericHeader(pgn, "WhiteElo");
  const blackRating = parseNumericHeader(pgn, "BlackElo");

  return {
    pgn,
    url: readHeader(pgn, "Site") ?? undefined,
    time_class: parseTimeClass(readHeader(pgn, "TimeControl")),
    end_time: parseEndTime(readHeader(pgn, "UTCDate"), readHeader(pgn, "UTCTime")),
    rules: "chess",
    white: {
      username: whiteUsername,
      rating: whiteRating,
      result: result === "1-0" ? "win" : result === "0-1" ? "loss" : "agreed"
    },
    black: {
      username: blackUsername,
      rating: blackRating,
      result: result === "0-1" ? "win" : result === "1-0" ? "loss" : "agreed"
    }
  };
}

function splitPgnGames(pgnText: string): string[] {
  const normalized = pgnText.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const lines = normalized.split("\n");
  const games: string[] = [];
  let current: string[] = [];
  let sawMoves = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[Event ") && current.length && sawMoves) {
      games.push(current.join("\n").trim());
      current = [line];
      sawMoves = false;
      continue;
    }

    current.push(line);

    if (trimmed && !trimmed.startsWith("[")) {
      sawMoves = true;
    }
  }

  if (current.length) {
    games.push(current.join("\n").trim());
  }

  return games.filter(Boolean);
}

function readHeader(pgn: string, header: string): string | null {
  const match = pgn.match(new RegExp(`\\[${header}\\s+"([^"]+)"\\]`));
  return match?.[1] ?? null;
}

function parseNumericHeader(pgn: string, header: string) {
  const value = readHeader(pgn, header);
  return value ? Number.parseInt(value, 10) || undefined : undefined;
}

function parseTimeClass(timeControl: string | null) {
  if (!timeControl || timeControl === "-") {
    return "rapid";
  }

  const match = timeControl.match(/^(\d+)(?:\+(\d+))?$/);

  if (!match) {
    return "rapid";
  }

  const baseSeconds = Number.parseInt(match[1], 10);
  const increment = Number.parseInt(match[2] ?? "0", 10);
  const estimatedTotal = baseSeconds + increment * 40;

  if (estimatedTotal < 180) {
    return "bullet";
  }

  if (estimatedTotal < 480) {
    return "blitz";
  }

  if (estimatedTotal < 1500) {
    return "rapid";
  }

  return "classical";
}

function parseEndTime(utcDate: string | null, utcTime: string | null) {
  if (!utcDate || !utcTime) {
    return undefined;
  }

  const normalizedDate = utcDate.replace(/\./g, "-");
  const timestamp = Date.parse(`${normalizedDate}T${utcTime}Z`);
  return Number.isNaN(timestamp) ? undefined : Math.floor(timestamp / 1000);
}
