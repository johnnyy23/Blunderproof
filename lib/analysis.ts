import type { ChessComGame } from "@/lib/chesscom";
import { tokenizePgn } from "@/lib/pgn";
import type { PieceColor } from "@/types/chess";

export type AnalysisMetric = {
  label: string;
  score: number;
  detail: string;
  status: "strong" | "review" | "warning";
  recommendation: string;
};

export type PatternPerformance = {
  name: string;
  games: number;
  score: number;
  wins: number;
  losses: number;
  draws: number;
};

export type OpeningPerformance = PatternPerformance;

export type TroubleExample = {
  url?: string;
  result: AnalyzedGame["result"];
  timeClass: string;
  endTime?: number;
  opening: string;
  openingPath: string;
  opponentRating: number;
};

export type CoverageGame = {
  url?: string;
  endTime?: number;
  opening: string;
  openingPath: string;
  playerColor: PieceColor;
  result: AnalyzedGame["result"];
  timeClass: string;
};

export type TroubleSpot = {
  pattern: PatternPerformance;
  examples: TroubleExample[];
};

export type OpeningExplorerEntry = {
  name: string;
  games: number;
  score: number;
  branches: PatternPerformance[];
  pawnBreaks: PatternPerformance[];
  examples: TroubleExample[];
};

export type ColorBreakdown = {
  color: PieceColor;
  games: number;
  score: number;
  wins: number;
  losses: number;
  draws: number;
  openingPerformance: OpeningPerformance[];
  openingPaths: PatternPerformance[];
  pawnBreaks: PatternPerformance[];
  weakestOpenings: TroubleSpot[];
  weakestOpeningPaths: TroubleSpot[];
};

export type AnalyzedGame = {
  url?: string;
  endTime?: number;
  opening: string;
  openingPath: string;
  playerColor: PieceColor;
  playerMoves: string[];
  pawnBreaks: string[];
  result: "win" | "loss" | "draw";
  moveCount: number;
  timeClass: string;
  byCheckmate: boolean;
  byTimeout: boolean;
  playerRating: number;
  opponentRating: number;
};

export type AnalysisReport = {
  username: string;
  gamesAnalyzed: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  metrics: AnalysisMetric[];
  openingPerformance: OpeningPerformance[];
  openingPaths: PatternPerformance[];
  pawnBreaks: PatternPerformance[];
  openingExplorer: OpeningExplorerEntry[];
  byColor: {
    white: ColorBreakdown;
    black: ColorBreakdown;
  };
  recentPatterns: string[];
  recentGames: TroubleExample[];
  coverageGames: CoverageGame[];
  recommendations: Array<{
    title: string;
    body: string;
    cta: string;
    suggestedCourseIds: string[];
  }>;
};

const whiteBreakTargets = new Set(["b4", "c4", "c5", "d4", "d5", "e4", "e5", "f4", "f5", "g4", "h4"]);
const blackBreakTargets = new Set(["b5", "c5", "c4", "d5", "d4", "e5", "e4", "f5", "f4", "g5", "h5"]);

export function analyzeChessComGames(username: string, games: ChessComGame[]): AnalysisReport {
  const analyzedGames = games
    .map((game) => analyzeGame(username, game))
    .filter((game): game is AnalyzedGame => game !== null);

  const overallScore = scoreFromGames(analyzedGames, 0);
  const whiteGames = analyzedGames.filter((game) => game.playerColor === "white");
  const blackGames = analyzedGames.filter((game) => game.playerColor === "black");
  const openingPerformance = buildPerformanceByName(
    analyzedGames.map((game) => ({
      name: game.opening,
      result: game.result
    }))
  );
  const openingPaths = buildPerformanceByName(
    analyzedGames
      .map((game) => ({
        name: game.openingPath,
        result: game.result
      }))
      .filter((entry) => entry.name.length > 0)
  );
  const pawnBreaks = buildPerformanceByName(
    analyzedGames.flatMap((game) =>
      Array.from(new Set(game.pawnBreaks)).map((name) => ({
        name,
        result: game.result
      }))
    )
  );
  const metrics = buildMetrics(analyzedGames, overallScore);
  const strengths = [...metrics]
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((metric) => `${metric.label}: ${metric.detail}`);
  const weaknesses = [...metrics]
    .sort((left, right) => left.score - right.score)
    .slice(0, 2)
    .map((metric) => `${metric.label}: ${metric.detail}`);

  return {
    username,
    gamesAnalyzed: analyzedGames.length,
    summary: buildSummary(overallScore, whiteGames, blackGames, openingPerformance, pawnBreaks),
    strengths,
    weaknesses,
    metrics,
    openingPerformance: openingPerformance.slice(0, 6),
    openingPaths: openingPaths.slice(0, 6),
    pawnBreaks: pawnBreaks.slice(0, 6),
    openingExplorer: buildOpeningExplorer(analyzedGames, openingPerformance),
    byColor: {
      white: buildColorBreakdown("white", whiteGames, overallScore),
      black: buildColorBreakdown("black", blackGames, overallScore)
    },
    recentPatterns: buildRecentPatterns(analyzedGames, openingPaths, pawnBreaks, whiteGames, blackGames),
    recentGames: buildRecentGames(analyzedGames),
    coverageGames: buildCoverageGames(analyzedGames),
    recommendations: buildRecommendations(metrics)
  };
}

function analyzeGame(username: string, game: ChessComGame): AnalyzedGame | null {
  const normalizedUsername = username.trim().toLowerCase();
  const whiteUsername = game.white?.username?.toLowerCase();
  const blackUsername = game.black?.username?.toLowerCase();
  const isWhite = whiteUsername === normalizedUsername;
  const isBlack = blackUsername === normalizedUsername;

  if (!isWhite && !isBlack) {
    return null;
  }

  const player = isWhite ? game.white : game.black;
  const opponent = isWhite ? game.black : game.white;
  const playerColor: PieceColor = isWhite ? "white" : "black";
  const result = mapResult(player?.result ?? "");
  const termination = player?.result ?? "";
  const sanMoves = tokenizePgn(game.pgn ?? "").map(normalizeSanToken).filter(Boolean);
  const moveCount = Math.max(1, sanMoves.length);
  const playerMoves = sanMoves.filter((_, index) => (isWhite ? index % 2 === 0 : index % 2 === 1));
  const headerOpening = readPgnHeader(game.pgn ?? "", "Opening");
  const headerEco = readPgnHeader(game.pgn ?? "", "ECO");
  const opening = buildOpeningName(headerOpening, headerEco, sanMoves);

  return {
    url: game.url,
    endTime: game.end_time,
    opening,
    openingPath: buildOpeningPath(sanMoves, opening),
    playerColor,
    playerMoves,
    pawnBreaks: extractPawnBreaks(playerMoves, playerColor),
    result,
    moveCount,
    timeClass: game.time_class ?? "rapid",
    byCheckmate: /checkmated/.test(termination) || /checkmated/.test(opponent?.result ?? ""),
    byTimeout: /timeout|timevsinsufficient/.test(termination) || /timeout|timevsinsufficient/.test(opponent?.result ?? ""),
    playerRating: typeof player?.rating === "number" ? player.rating : 0,
    opponentRating: typeof opponent?.rating === "number" ? opponent.rating : 0
  };
}

function buildColorBreakdown(color: PieceColor, games: AnalyzedGame[], fallbackScore: number): ColorBreakdown {
  const openingPerformance = buildPerformanceByName(
    games.map((game) => ({
      name: game.opening,
      result: game.result
    }))
  );
  const openingPaths = buildPerformanceByName(
    games
      .map((game) => ({
        name: game.openingPath,
        result: game.result
      }))
      .filter((entry) => entry.name.length > 0)
  );
  const pawnBreaks = buildPerformanceByName(
    games.flatMap((game) =>
      Array.from(new Set(game.pawnBreaks)).map((name) => ({
        name,
        result: game.result
      }))
    )
  );

  return {
    color,
    games: games.length,
    score: scoreFromGames(games, fallbackScore),
    wins: games.filter((game) => game.result === "win").length,
    losses: games.filter((game) => game.result === "loss").length,
    draws: games.filter((game) => game.result === "draw").length,
    openingPerformance: openingPerformance.slice(0, 4),
    openingPaths: openingPaths.slice(0, 4),
    pawnBreaks: pawnBreaks.slice(0, 4),
    weakestOpenings: buildTroubleSpots(buildWeakestPatterns(openingPerformance), games, "opening"),
    weakestOpeningPaths: buildTroubleSpots(buildWeakestPatterns(openingPaths), games, "openingPath")
  };
}

function buildMetrics(games: AnalyzedGame[], overallScore: number): AnalysisMetric[] {
  const openingGames = games;
  const tacticalGames = games.filter((game) => game.moveCount >= 12 && game.moveCount <= 35);
  const endgameGames = games.filter((game) => game.moveCount >= 45);
  const favoredGames = games.filter((game) => game.playerRating - game.opponentRating >= 50);
  const underdogGames = games.filter((game) => game.opponentRating - game.playerRating >= 75);
  const timeoutLosses = games.filter((game) => game.result === "loss" && game.byTimeout).length;
  const tacticalBaseScore = scoreFromGames(tacticalGames, overallScore);
  const endgameScore = scoreFromGames(endgameGames, overallScore);
  const favoredScore = scoreFromGames(favoredGames, overallScore);
  const resourcefulnessScore = clampScore(scoreFromGames(underdogGames, overallScore) + draws(underdogGames) * 5);
  const timeManagementScore = clampScore(overallScore - timeoutLosses * 18 + countTimeoutWins(games) * 6);

  return [
    {
      label: "Opening performance",
      score: scoreFromGames(openingGames, overallScore),
      detail: describeRecord(openingGames, "recent games in your opening sample"),
      status: getMetricStatus(scoreFromGames(openingGames, overallScore)),
      recommendation: "Review your first 8-10 moves in your most-played openings and tighten the lines that keep repeating."
    },
    {
      label: "Tactical skill",
      score: clampScore(tacticalBaseScore + countByResult(tacticalGames, "win", true) * 4 - countByResult(tacticalGames, "loss", true) * 4),
      detail: describeTacticalGames(tacticalGames),
      status: getMetricStatus(clampScore(tacticalBaseScore + countByResult(tacticalGames, "win", true) * 4 - countByResult(tacticalGames, "loss", true) * 4)),
      recommendation: "Spend your next sessions on forcing-move calculation and short tactical drills before you play."
    },
    {
      label: "Endgame skill",
      score: endgameScore,
      detail: describeRecord(endgameGames, "longer games and late conversions"),
      status: getMetricStatus(endgameScore),
      recommendation: "Work on king-and-pawn and rook endgame technique so your long games feel easier to convert or save."
    },
    {
      label: "Advantage capitalization",
      score: favoredScore,
      detail: describeRecord(favoredGames, "games where you started with a rating edge"),
      status: getMetricStatus(favoredScore),
      recommendation: "Practice simplifying from better positions instead of hunting for perfect tactics when you are already better."
    },
    {
      label: "Resourcefulness",
      score: resourcefulnessScore,
      detail: describeRecord(underdogGames, "games against stronger opposition"),
      status: getMetricStatus(resourcefulnessScore),
      recommendation: "Train defensive lines and swindle patterns so tougher positions still give you practical chances."
    },
    {
      label: "Time management",
      score: timeManagementScore,
      detail: timeoutLosses ? `${timeoutLosses} recent loss${timeoutLosses === 1 ? "" : "es"} came from time pressure.` : "No recent timeout losses in the sample.",
      status: getMetricStatus(timeManagementScore),
      recommendation: "Use simpler plans in familiar openings so you save clock for middlegame decisions."
    }
  ];
}

function buildPerformanceByName(entries: Array<{ name: string; result: AnalyzedGame["result"] }>): PatternPerformance[] {
  const buckets = new Map<string, PatternPerformance>();

  for (const entry of entries) {
    const normalizedName = entry.name.trim();

    if (!normalizedName) {
      continue;
    }

    const current = buckets.get(normalizedName) ?? {
      name: normalizedName,
      games: 0,
      score: 0,
      wins: 0,
      losses: 0,
      draws: 0
    };

    current.games += 1;

    if (entry.result === "win") {
      current.wins += 1;
      current.score += 1;
    } else if (entry.result === "draw") {
      current.draws += 1;
      current.score += 0.5;
    } else {
      current.losses += 1;
    }

    buckets.set(normalizedName, current);
  }

  return Array.from(buckets.values())
    .sort((left, right) => right.games - left.games || right.score - left.score)
    .map((bucket) => ({
      ...bucket,
      score: Math.round((bucket.score / bucket.games) * 100)
    }));
}

function buildSummary(
  overallScore: number,
  whiteGames: AnalyzedGame[],
  blackGames: AnalyzedGame[],
  openings: OpeningPerformance[],
  pawnBreaks: PatternPerformance[]
): string {
  const totalGames = whiteGames.length + blackGames.length;

  if (!totalGames) {
    return "We could not read enough recent games to build a useful report yet.";
  }

  const topOpening = openings[0];
  const topPawnBreak = pawnBreaks[0];
  const whiteScore = scoreFromGames(whiteGames, overallScore);
  const blackScore = scoreFromGames(blackGames, overallScore);

  if (topOpening && topPawnBreak) {
    return `Across your last ${totalGames} games, you scored about ${overallScore}% overall. As White you scored ${whiteScore}%, as Black ${blackScore}%. You reached ${topOpening.name} most often, and your most common pawn break was ${topPawnBreak.name}.`;
  }

  return `Across your last ${totalGames} games, you scored about ${overallScore}% overall. As White you scored ${whiteScore}%, as Black ${blackScore}%.`;
}

function buildRecentPatterns(
  games: AnalyzedGame[],
  openingPaths: PatternPerformance[],
  pawnBreaks: PatternPerformance[],
  whiteGames: AnalyzedGame[],
  blackGames: AnalyzedGame[]
): string[] {
  const patterns: string[] = [];
  const topPath = openingPaths[0];
  const topPawnBreak = pawnBreaks[0];
  const timeoutLosses = games.filter((game) => game.result === "loss" && game.byTimeout).length;
  const whiteScore = scoreFromGames(whiteGames, scoreFromGames(games, 0));
  const blackScore = scoreFromGames(blackGames, scoreFromGames(games, 0));

  if (topPath) {
    patterns.push(`Your most common opening path was ${topPath.name}, showing up in ${topPath.games} game${topPath.games === 1 ? "" : "s"}.`);
  }

  if (topPawnBreak) {
    patterns.push(`Your most common pawn break was ${topPawnBreak.name}, and you scored ${topPawnBreak.score}% in games where it appeared.`);
  }

  patterns.push(`You scored ${whiteScore}% as White and ${blackScore}% as Black in this sample.`);

  if (timeoutLosses) {
    patterns.push(`${timeoutLosses} loss${timeoutLosses === 1 ? "" : "es"} came from time trouble, so familiar plans would buy you clock back.`);
  }

  return patterns.slice(0, 4);
}

function readPgnHeader(pgn: string, header: string): string | null {
  const match = pgn.match(new RegExp(`\\[${header}\\s+\"([^\"]+)\"\\]`));
  return match?.[1] ?? null;
}

function normalizeSanToken(token: string): string {
  return token.replace(/^[.]+/, "").replace(/[!?]+/g, "").replace(/[+#]+$/g, "").trim();
}

function buildOpeningPath(sanMoves: string[], openingName: string): string {
  const path = sanMoves.slice(0, Math.min(8, sanMoves.length));
  const joined = path.join(" ");

  if (!joined) {
    return "";
  }

  const friendlyName = inferBranchName(path, openingName);

  return friendlyName ?? joined;
}

function buildOpeningName(headerOpening: string | null, headerEco: string | null, sanMoves: string[]): string {
  const cleanedHeader = cleanOpeningHeader(headerOpening);

  if (cleanedHeader) {
    const inferredBranch = inferBranchName(sanMoves.slice(0, Math.min(8, sanMoves.length)), cleanedHeader);

    if (inferredBranch && !cleanedHeader.toLowerCase().includes(inferredBranch.toLowerCase())) {
      return headerEco ? `${cleanedHeader} (${headerEco})` : cleanedHeader;
    }

    return headerEco ? `${cleanedHeader} (${headerEco})` : cleanedHeader;
  }

  return inferOpeningFromPath(sanMoves, headerEco) ?? "Unlabeled Opening";
}

function inferOpeningFromPath(sanMoves: string[], eco: string | null): string | null {
  const path = sanMoves.slice(0, Math.min(8, sanMoves.length)).join(" ");

  if (!path) {
    return null;
  }

  if (path.startsWith("d4 Nf6 Nc3")) {
    return eco ? `Jobava London / Veresov setup (${eco})` : "Jobava London / Veresov setup";
  }

  if (path.startsWith("d4 d5 Bf4")) {
    return eco ? `London System (${eco})` : "London System";
  }

  if (path.startsWith("e4 c6")) {
    return eco ? `Caro-Kann Defense (${eco})` : "Caro-Kann Defense";
  }

  if (path.startsWith("e4 c5")) {
    return eco ? `Sicilian Defense (${eco})` : "Sicilian Defense";
  }

  if (path.startsWith("e4 e5 Nf3 Nc6 Bc4")) {
    return eco ? `Italian Game (${eco})` : "Italian Game";
  }

  if (path.startsWith("e4 e5 Nf3 Nc6 Bb5")) {
    return eco ? `Ruy Lopez (${eco})` : "Ruy Lopez";
  }

  if (path.startsWith("d4 d5 c4")) {
    return eco ? `Queen's Gambit (${eco})` : "Queen's Gambit";
  }

  if (path.startsWith("d4 Nf6 c4 g6")) {
    return eco ? `King's Indian / Gruenfeld family (${eco})` : "King's Indian / Gruenfeld family";
  }

  return null;
}

function inferBranchName(pathMoves: string[], openingName: string): string | null {
  const path = pathMoves.join(" ");
  const normalizedOpening = openingName.toLowerCase();

  if (normalizedOpening.includes("london") || normalizedOpening.includes("jobava") || normalizedOpening.includes("veresov")) {
    if (path.includes("Nc3") && path.includes("Bf4")) {
      return "Jobava setup";
    }

    if (path.includes("Bf4") && path.includes("e3")) {
      return "Classical London setup";
    }
  }

  if (normalizedOpening.includes("caro-kann")) {
    if (path.startsWith("e4 c6 d4 d5 e5")) {
      return "Advance Variation";
    }

    if (path.startsWith("e4 c6 d4 d5 exd5")) {
      return "Exchange Variation";
    }

    if (path.startsWith("e4 c6 d4 d5 Nc3")) {
      return "Classical / Two Knights";
    }
  }

  if (normalizedOpening.includes("sicilian")) {
    if (path.startsWith("e4 c5 Nf3 d6 d4")) {
      return "Open Sicilian";
    }

    if (path.includes("c3")) {
      return "Alapin setup";
    }
  }

  if (normalizedOpening.includes("queen's gambit")) {
    if (path.startsWith("d4 d5 c4 e6 Nc3")) {
      return "Queen's Gambit Declined";
    }

    if (path.startsWith("d4 d5 c4 dxc4")) {
      return "Queen's Gambit Accepted";
    }
  }

  if (normalizedOpening.includes("italian")) {
    if (path.includes("Bc4") && path.includes("c3")) {
      return "Italian center build";
    }

    return "Italian main setup";
  }

  if (normalizedOpening.includes("ruy lopez")) {
    if (path.includes("a6")) {
      return "Morphy Defence";
    }

    return "Ruy Lopez main setup";
  }

  return null;
}

function cleanOpeningHeader(headerOpening: string | null): string | null {
  if (!headerOpening) {
    return null;
  }

  const cleaned = headerOpening
    .replace(/\s+/g, " ")
    .replace(/\b(Opening|Defense|Defence):\s*/i, (match) => match.charAt(0).toUpperCase() + match.slice(1))
    .trim();

  if (!cleaned || /^(untitled|unlabeled opening)$/i.test(cleaned)) {
    return null;
  }

  return cleaned;
}

function extractPawnBreaks(playerMoves: string[], color: PieceColor): string[] {
  const interestingTargets = color === "white" ? whiteBreakTargets : blackBreakTargets;
  const breaks: string[] = [];

  for (const move of playerMoves) {
    const target = readPawnDestination(move);

    if (target && interestingTargets.has(target)) {
      breaks.push(`${target} break`);
    }
  }

  return breaks;
}

function readPawnDestination(san: string): string | null {
  const pushMatch = san.match(/^([a-h][1-8])(?:=[QRBN])?$/);

  if (pushMatch) {
    return pushMatch[1];
  }

  const captureMatch = san.match(/^[a-h]x([a-h][1-8])(?:=[QRBN])?$/);

  return captureMatch?.[1] ?? null;
}

function mapResult(result: string): "win" | "loss" | "draw" {
  if (["win", "agreed", "repetition", "stalemate", "50move", "insufficient", "timevsinsufficient"].includes(result)) {
    return result === "win" ? "win" : "draw";
  }

  return "loss";
}

function scoreFromGames(games: AnalyzedGame[], fallbackScore: number): number {
  if (!games.length) {
    return fallbackScore;
  }

  const points = games.reduce((sum, game) => {
    if (game.result === "win") {
      return sum + 1;
    }

    if (game.result === "draw") {
      return sum + 0.5;
    }

    return sum;
  }, 0);

  return Math.round((points / games.length) * 100);
}

function describeRecord(games: AnalyzedGame[], context: string): string {
  if (!games.length) {
    return `Not enough ${context} in the current sample yet.`;
  }

  return `${wins(games)} wins, ${draws(games)} draws, ${losses(games)} losses in ${context}.`;
}

function describeTacticalGames(games: AnalyzedGame[]): string {
  if (!games.length) {
    return "Not enough sharp middlegame games in the current sample yet.";
  }

  const mateWins = countByResult(games, "win", true);
  const mateLosses = countByResult(games, "loss", true);

  return `${mateWins} decisive tactical win${mateWins === 1 ? "" : "s"} and ${mateLosses} tactical loss${mateLosses === 1 ? "" : "es"} in sharper recent games.`;
}

function countByResult(games: AnalyzedGame[], result: "win" | "loss" | "draw", checkmateOnly = false): number {
  return games.filter((game) => game.result === result && (!checkmateOnly || game.byCheckmate)).length;
}

function countTimeoutWins(games: AnalyzedGame[]): number {
  return games.filter((game) => game.result === "win" && game.byTimeout).length;
}

function wins(games: AnalyzedGame[]): number {
  return countByResult(games, "win");
}

function losses(games: AnalyzedGame[]): number {
  return countByResult(games, "loss");
}

function draws(games: AnalyzedGame[]): number {
  return countByResult(games, "draw");
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getMetricStatus(score: number): AnalysisMetric["status"] {
  if (score >= 75) {
    return "strong";
  }

  if (score >= 45) {
    return "review";
  }

  return "warning";
}

function buildRecommendations(metrics: AnalysisMetric[]): AnalysisReport["recommendations"] {
  return [...metrics]
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((metric) => ({
      title: metric.label,
      body: metric.recommendation,
      cta: metric.label === "Opening performance" ? "Review opening course" : metric.label === "Endgame skill" ? "Train endgames" : "Review this skill",
      suggestedCourseIds: getSuggestedCourseIds(metric.label)
    }));
}

function buildWeakestPatterns(patterns: PatternPerformance[]): PatternPerformance[] {
  return patterns
    .filter((pattern) => pattern.games >= 2)
    .sort((left, right) => left.score - right.score || right.games - left.games)
    .slice(0, 3);
}

function buildTroubleSpots(
  patterns: PatternPerformance[],
  games: AnalyzedGame[],
  key: "opening" | "openingPath"
): TroubleSpot[] {
  return patterns.map((pattern) => ({
    pattern,
    examples: games
      .filter((game) => game[key] === pattern.name)
      .sort((left, right) => (right.endTime ?? 0) - (left.endTime ?? 0))
      .slice(0, 2)
      .map((game) => ({
        url: game.url,
        result: game.result,
        timeClass: game.timeClass,
        endTime: game.endTime,
        opening: game.opening,
        openingPath: game.openingPath,
        opponentRating: game.opponentRating
      }))
  }));
}

function buildRecentGames(games: AnalyzedGame[]): TroubleExample[] {
  return [...games]
    .sort((left, right) => (right.endTime ?? 0) - (left.endTime ?? 0))
    .slice(0, 8)
    .map((game) => ({
      url: game.url,
      result: game.result,
      timeClass: game.timeClass,
      endTime: game.endTime,
      opening: game.opening,
      openingPath: game.openingPath,
      opponentRating: game.opponentRating
    }));
}

function buildCoverageGames(games: AnalyzedGame[]): CoverageGame[] {
  return [...games]
    .sort((left, right) => (right.endTime ?? 0) - (left.endTime ?? 0))
    .map((game) => ({
      url: game.url,
      endTime: game.endTime,
      opening: game.opening,
      openingPath: game.openingPath,
      playerColor: game.playerColor,
      result: game.result,
      timeClass: game.timeClass
    }));
}

function buildOpeningExplorer(games: AnalyzedGame[], openings: PatternPerformance[]): OpeningExplorerEntry[] {
  return openings.slice(0, 8).map((opening) => {
    const openingGames = games.filter((game) => game.opening === opening.name);
    const branches = buildPerformanceByName(
      openingGames
        .map((game) => ({
          name: game.openingPath,
          result: game.result
        }))
        .filter((entry) => entry.name.length > 0)
    ).slice(0, 5);

    const examples = [...openingGames]
      .sort((left, right) => (right.endTime ?? 0) - (left.endTime ?? 0))
      .slice(0, 3)
      .map((game) => ({
        url: game.url,
        result: game.result,
        timeClass: game.timeClass,
        endTime: game.endTime,
        opening: game.opening,
        openingPath: game.openingPath,
        opponentRating: game.opponentRating
      }));

    return {
      name: opening.name,
      games: opening.games,
      score: opening.score,
      branches,
      pawnBreaks: buildPerformanceByName(
        openingGames.flatMap((game) =>
          Array.from(new Set(game.pawnBreaks)).map((name) => ({
            name,
            result: game.result
          }))
        )
      ).slice(0, 4),
      examples
    };
  });
}

function getSuggestedCourseIds(label: string): string[] {
  switch (label) {
    case "Opening performance":
      return ["london-system", "jobava-london", "caro-kann"];
    case "Endgame skill":
      return ["beginner-endgames", "intermediate-endgames"];
    case "Time management":
      return ["london-system", "caro-kann"];
    case "Tactical skill":
      return ["jobava-london", "caro-kann"];
    case "Advantage capitalization":
      return ["intermediate-endgames", "caro-kann"];
    case "Resourcefulness":
      return ["beginner-endgames", "intermediate-endgames", "caro-kann"];
    default:
      return [];
  }
}
