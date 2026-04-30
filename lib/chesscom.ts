export type ChessComPlayer = {
  username?: string;
  rating?: number;
  result?: string;
};

export type ChessComGame = {
  url?: string;
  pgn?: string;
  time_class?: string;
  end_time?: number;
  rules?: string;
  white?: ChessComPlayer;
  black?: ChessComPlayer;
};

export function normalizeChessComUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function fetchRecentChessComGames(username: string, limit = 40): Promise<ChessComGame[]> {
  const normalizedUsername = normalizeChessComUsername(username);

  if (!normalizedUsername) {
    return [];
  }

  const archivesResponse = await fetch(`https://api.chess.com/pub/player/${normalizedUsername}/games/archives`);

  if (!archivesResponse.ok) {
    throw new Error("Could not fetch Chess.com archives for that username.");
  }

  const archivesPayload = (await archivesResponse.json()) as { archives?: string[] };
  const archives = [...(archivesPayload.archives ?? [])].reverse();
  const games: ChessComGame[] = [];

  for (const archiveUrl of archives) {
    if (games.length >= limit) {
      break;
    }

    const archiveResponse = await fetch(archiveUrl);

    if (!archiveResponse.ok) {
      continue;
    }

    const archivePayload = (await archiveResponse.json()) as { games?: ChessComGame[] };
    const archiveGames = (archivePayload.games ?? [])
      .filter((game) => game.rules === "chess")
      .sort((left, right) => (right.end_time ?? 0) - (left.end_time ?? 0));

    games.push(...archiveGames);
  }

  return games
    .sort((left, right) => (right.end_time ?? 0) - (left.end_time ?? 0))
    .slice(0, limit);
}
