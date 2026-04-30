"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { analyzeChessComGames, type AnalysisMetric, type AnalysisReport } from "@/lib/analysis";
import { fetchRecentChessComGames, type ChessComGame } from "@/lib/chesscom";
import { fetchRecentLichessGames } from "@/lib/lichess";
import { buildAnalysisGamesFromPgn } from "@/lib/analysisPgn";
import type { OpeningCourse } from "@/lib/courses";

type AnalysisPageProps = {
  activeSection: string;
  onOpenCourseSuggestion: (courseId: string) => void;
  onOpenWeaknessTarget: (patternName: string, color: "white" | "black") => void;
  availableCourses: OpeningCourse[];
};

const analysisStorageKey = "blounderproof:analysis-filters:v1";
const analysisCacheStorageKey = "blounderproof:analysis-cache:v1";
const analysisPeerStorageKey = "blounderproof:analysis-peers:v1";
const analysisSnapshotsStorageKey = "blounderproof:analysis-snapshots:v1";
type AnalysisSource = "lichess" | "pgn" | "chesscom";

type LocalPeerSnapshot = {
  username: string;
  source: AnalysisSource;
  averageRating: number;
  ratingBand: string;
  gamesAnalyzed: number;
  timeClassFilter: "all" | "rapid" | "blitz" | "bullet";
  colorFilter: "all" | "white" | "black";
  metrics: Array<{
    label: string;
    score: number;
  }>;
  capturedAt: number;
};

type PeerComparison = {
  ratingBand: string;
  averageRating: number;
  sampleSize: number;
  metrics: Array<{
    label: string;
    playerScore: number;
    peerScore: number;
    delta: number;
    status: "above" | "around" | "below";
  }>;
};

type SavedAnalysisSnapshot = {
  id: string;
  username: string;
  source: AnalysisSource;
  capturedAt: number;
  gamesAnalyzed: number;
  averageRating: number | null;
  filters: {
    gameCountFilter: 20 | 40 | 100;
    timeClassFilter: "all" | "rapid" | "blitz" | "bullet";
    colorFilter: "all" | "white" | "black";
  };
  summary: string;
  overallScore: number;
  overallWinRate: number;
  byColor: {
    white: {
      score: number;
      wins: number;
      draws: number;
      losses: number;
      games: number;
    };
    black: {
      score: number;
      wins: number;
      draws: number;
      losses: number;
      games: number;
    };
  };
  metrics: Array<{
    label: string;
    score: number;
    detail: string;
  }>;
  topOpenings: Array<{
    name: string;
    score: number;
    games: number;
  }>;
  repertoireCoverage: {
    coverage: number;
    coveredGames: number;
    uncoveredGames: number;
  } | null;
};

export function AnalysisPage({ activeSection, onOpenCourseSuggestion, onOpenWeaknessTarget, availableCourses }: AnalysisPageProps) {
  const [analysisSource, setAnalysisSource] = useState<AnalysisSource>("lichess");
  const [username, setUsername] = useState("");
  const [pgnText, setPgnText] = useState("");
  const [isDraggingPgn, setIsDraggingPgn] = useState(false);
  const [fetchedGames, setFetchedGames] = useState<ChessComGame[]>([]);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [selectedOpeningName, setSelectedOpeningName] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [peerComparison, setPeerComparison] = useState<PeerComparison | null>(null);
  const [savedSnapshots, setSavedSnapshots] = useState<SavedAnalysisSnapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameCountFilter, setGameCountFilter] = useState<20 | 40 | 100>(40);
  const [timeClassFilter, setTimeClassFilter] = useState<"all" | "rapid" | "blitz" | "bullet">("all");
  const [colorFilter, setColorFilter] = useState<"all" | "white" | "black">("all");
  const filteredGames = filterAnalysisGames(fetchedGames, username, timeClassFilter, colorFilter, gameCountFilter);
  const averageRating = getAveragePlayerRating(filteredGames, username);
  const parsedPgnGames = useMemo(() => (pgnText.trim() ? buildAnalysisGamesFromPgn(pgnText) : []), [pgnText]);
  const selectedOpeningExplorer = useMemo(
    () => report?.openingExplorer.find((entry) => entry.name === selectedOpeningName) ?? report?.openingExplorer[0] ?? null,
    [report, selectedOpeningName]
  );
  const selectedBranch = useMemo(
    () => selectedOpeningExplorer?.branches.find((branch) => branch.name === selectedBranchName) ?? selectedOpeningExplorer?.branches[0] ?? null,
    [selectedBranchName, selectedOpeningExplorer]
  );
  const selectedBranchExamples = useMemo(
    () =>
      selectedOpeningExplorer && selectedBranch
        ? report?.recentGames.filter((game) => game.opening === selectedOpeningExplorer.name && game.openingPath === selectedBranch.name).slice(0, 3) ?? []
        : [],
    [report?.recentGames, selectedBranch, selectedOpeningExplorer]
  );
  const repertoireCoverage = useMemo(
    () => (report ? buildRepertoireCoverage(report, availableCourses) : null),
    [availableCourses, report]
  );
  const relevantSnapshots = useMemo(
    () =>
      savedSnapshots
        .filter(
          (snapshot) =>
            snapshot.username === username.trim().toLowerCase() &&
            snapshot.source === analysisSource
        )
        .sort((left, right) => right.capturedAt - left.capturedAt),
    [analysisSource, savedSnapshots, username]
  );
  const selectedSnapshot = useMemo(
    () =>
      relevantSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ??
      relevantSnapshots[0] ??
      null,
    [relevantSnapshots, selectedSnapshotId]
  );
  const snapshotComparison = useMemo(
    () =>
      report && selectedSnapshot
        ? buildSnapshotComparison(report, repertoireCoverage, selectedSnapshot, {
            analysisSource,
            averageRating,
            gameCountFilter,
            timeClassFilter,
            colorFilter
          })
        : null,
    [analysisSource, averageRating, colorFilter, gameCountFilter, report, repertoireCoverage, selectedSnapshot, timeClassFilter]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(analysisStorageKey);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        source?: AnalysisSource;
        username?: string;
        gameCountFilter?: 20 | 40 | 100;
        timeClassFilter?: "all" | "rapid" | "blitz" | "bullet";
        colorFilter?: "all" | "white" | "black";
      };

      if (parsed.source === "lichess" || parsed.source === "pgn" || parsed.source === "chesscom") {
        setAnalysisSource(parsed.source);
      }

      if (typeof parsed.username === "string") {
        setUsername(parsed.username);
      }

      if (parsed.gameCountFilter === 20 || parsed.gameCountFilter === 40 || parsed.gameCountFilter === 100) {
        setGameCountFilter(parsed.gameCountFilter);
      }

      if (parsed.timeClassFilter === "all" || parsed.timeClassFilter === "rapid" || parsed.timeClassFilter === "blitz" || parsed.timeClassFilter === "bullet") {
        setTimeClassFilter(parsed.timeClassFilter);
      }

      if (parsed.colorFilter === "all" || parsed.colorFilter === "white" || parsed.colorFilter === "black") {
        setColorFilter(parsed.colorFilter);
      }
    } catch {
      // Ignore bad local data and keep defaults.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setSavedSnapshots(readSavedSnapshots());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(analysisCacheStorageKey);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        source?: AnalysisSource;
        username?: string;
        games?: ChessComGame[];
      };

      if (!parsed.games?.length || typeof parsed.username !== "string") {
        return;
      }

      setFetchedGames(parsed.games);

      if (parsed.source === "lichess" || parsed.source === "pgn" || parsed.source === "chesscom") {
        setAnalysisSource(parsed.source);
      }

      if (!username.trim()) {
        setUsername(parsed.username);
      }
    } catch {
      // Ignore bad cached data and keep defaults.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      analysisStorageKey,
      JSON.stringify({
        source: analysisSource,
        username,
        gameCountFilter,
        timeClassFilter,
        colorFilter
      })
    );
  }, [analysisSource, colorFilter, gameCountFilter, timeClassFilter, username]);

  useEffect(() => {
    if (typeof window === "undefined" || !fetchedGames.length || !username.trim()) {
      return;
    }

    window.localStorage.setItem(
      analysisCacheStorageKey,
      JSON.stringify({
        source: analysisSource,
        username,
        games: fetchedGames
      })
    );
  }, [analysisSource, fetchedGames, username]);

  useEffect(() => {
    const target = document.getElementById(`analysis-${activeSection}`);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeSection]);

  async function handleAnalyze() {
    setIsLoading(true);
    setError(null);

    try {
      const games = analysisSource === "lichess"
        ? await fetchRecentLichessGames(username, 100)
        : await fetchRecentChessComGames(username, 100);
      setFetchedGames(games);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : analysisSource === "lichess"
            ? "Could not analyze that Lichess account."
            : "Could not analyze that Chess.com account."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleAnalyzePgn() {
    setError(null);

    if (!pgnText.trim()) {
      setError("Paste a PGN or upload a PGN file first.");
      return;
    }

    if (!username.trim()) {
      setError("Add the username that appears inside the PGN before running the analysis.");
      return;
    }

    const games = parsedPgnGames;

    if (!games.length) {
      setError("We could not read any valid games from that PGN. Try exporting again and make sure the file includes full PGN headers and moves.");
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    const matchingGames = games.filter(
      (game) =>
        game.white?.username?.toLowerCase() === normalizedUsername ||
        game.black?.username?.toLowerCase() === normalizedUsername
    );

    if (!matchingGames.length) {
      setError("We found PGN games, but none of them matched that username. Double-check the username exactly as it appears in the PGN headers.");
      return;
    }

    setFetchedGames(games);
  }

  async function handlePgnFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      setPgnText(text);
      setError(null);
    } catch {
      setError("We could not read that PGN file.");
    }
  }

  async function loadPgnFile(file: File) {
    try {
      const text = await file.text();
      setPgnText(text);
      setError(null);
      setAnalysisSource("pgn");
    } catch {
      setError("We could not read that PGN file.");
    }
  }

  function handlePgnDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingPgn(true);
  }

  function handlePgnDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingPgn(false);
  }

  async function handlePgnDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingPgn(false);

    const file = Array.from(event.dataTransfer.files).find((candidate) => {
      const lowerName = candidate.name.toLowerCase();
      return lowerName.endsWith(".pgn") || candidate.type === "text/plain";
    });

    if (!file) {
      setError("Drop a .pgn file or a plain text PGN export.");
      return;
    }

    await loadPgnFile(file);
  }

  useEffect(() => {
    if (!fetchedGames.length || !username.trim()) {
      setReport(null);
      setPeerComparison(null);
      return;
    }

    setReport(analyzeChessComGames(username, filteredGames));
  }, [colorFilter, fetchedGames, gameCountFilter, timeClassFilter, username]);

  useEffect(() => {
    if (!report || !username.trim() || !averageRating || report.gamesAnalyzed < 10 || typeof window === "undefined") {
      return;
    }

    const nextSnapshot: LocalPeerSnapshot = {
      username: username.trim().toLowerCase(),
      source: analysisSource,
      averageRating,
      ratingBand: getRatingBand(averageRating),
      gamesAnalyzed: report.gamesAnalyzed,
      timeClassFilter,
      colorFilter,
      metrics: report.metrics.map((metric) => ({
        label: metric.label,
        score: metric.score
      })),
      capturedAt: Date.now()
    };

    const snapshots = readPeerSnapshots();
    const deduped = snapshots.filter(
      (snapshot) =>
        !(
          snapshot.username === nextSnapshot.username &&
          snapshot.source === nextSnapshot.source &&
          snapshot.timeClassFilter === nextSnapshot.timeClassFilter &&
          snapshot.colorFilter === nextSnapshot.colorFilter
        )
    );

    window.localStorage.setItem(
      analysisPeerStorageKey,
      JSON.stringify([nextSnapshot, ...deduped].slice(0, 200))
    );
  }, [analysisSource, averageRating, colorFilter, report, timeClassFilter, username]);

  useEffect(() => {
    if (!report || !username.trim() || !averageRating) {
      setPeerComparison(null);
      return;
    }

    setPeerComparison(
      buildPeerComparison({
        snapshots: readPeerSnapshots(),
        source: analysisSource,
        username,
        averageRating,
        report,
        timeClassFilter,
        colorFilter
      })
    );
  }, [analysisSource, averageRating, colorFilter, report, timeClassFilter, username]);

  useEffect(() => {
    setSelectedOpeningName((current) => {
      if (!report?.openingExplorer.length) {
        return null;
      }

      if (current && report.openingExplorer.some((entry) => entry.name === current)) {
        return current;
      }

      return report.openingExplorer[0].name;
    });
  }, [report]);

  useEffect(() => {
    setSelectedBranchName((current) => {
      if (!selectedOpeningExplorer?.branches.length) {
        return null;
      }

      if (current && selectedOpeningExplorer.branches.some((branch) => branch.name === current)) {
        return current;
      }

      return selectedOpeningExplorer.branches[0].name;
    });
  }, [selectedOpeningExplorer]);

  useEffect(() => {
    if (!relevantSnapshots.length) {
      setSelectedSnapshotId(null);
      return;
    }

    setSelectedSnapshotId((current) =>
      current && relevantSnapshots.some((snapshot) => snapshot.id === current) ? current : relevantSnapshots[0].id
    );
  }, [relevantSnapshots]);

  function handleExportReport() {
    if (!report || typeof window === "undefined") {
      return;
    }

    const lines = [
      `${report.username} analysis snapshot`,
      `Source: ${analysisSource === "lichess" ? "Lichess" : analysisSource === "pgn" ? "PGN upload" : "Chess.com prototype"}`,
      `Games analyzed: ${report.gamesAnalyzed}`,
      "",
      "Summary",
      report.summary,
      "",
      "Metrics",
      ...report.metrics.map((metric) => `- ${metric.label}: ${metric.score}% (${metric.detail})`),
      "",
      "Top openings",
      ...report.openingPerformance.map((opening) => `- ${opening.name}: ${opening.score}% over ${opening.games} games`),
      "",
      "Top pawn breaks",
      ...report.pawnBreaks.map((pawnBreak) => `- ${pawnBreak.name}: ${pawnBreak.score}% over ${pawnBreak.games} games`)
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.username}-analysis-report.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function handleSaveSnapshot() {
    if (!report || typeof window === "undefined") {
      return;
    }

    const snapshot = buildSavedSnapshot({
      report,
      repertoireCoverage,
      analysisSource,
      averageRating,
      gameCountFilter,
      timeClassFilter,
      colorFilter
    });
    const nextSnapshots = [snapshot, ...readSavedSnapshots()].slice(0, 40);
    window.localStorage.setItem(analysisSnapshotsStorageKey, JSON.stringify(nextSnapshots));
    setSavedSnapshots(nextSnapshots);
    setSelectedSnapshotId(snapshot.id);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Analysis</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Game review</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Analyze recent games from Lichess, upload PGN from any site, or keep using Chess.com as a temporary prototype path while we harden the analysis stack.
            </p>
          </div>
          <div className="w-full max-w-xl">
            <div className="mb-3 flex flex-wrap gap-2">
              {([
                { id: "lichess", label: "Lichess", accent: "border-emerald-300/40 bg-emerald-300/10 text-emerald-100" },
                { id: "pgn", label: "PGN upload", accent: "border-violet-300/40 bg-violet-300/10 text-violet-100" },
                { id: "chesscom", label: "Chess.com prototype", accent: "border-amber-300/40 bg-amber-300/10 text-amber-100" }
              ] as const).map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => {
                    setAnalysisSource(source.id);
                    setFetchedGames([]);
                    setReport(null);
                    setError(null);
                  }}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
                    analysisSource === source.id
                      ? source.accent
                      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  {source.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={
                  analysisSource === "lichess"
                    ? "Lichess username"
                    : analysisSource === "chesscom"
                      ? "Chess.com username"
                      : "Your username inside the PGN"
                }
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
              />
              {analysisSource === "pgn" ? (
                <button
                  type="button"
                  onClick={handleAnalyzePgn}
                  disabled={!username.trim() || !pgnText.trim()}
                  className="rounded-md border border-violet-300/30 bg-violet-300/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Analyze PGN
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!username.trim() || isLoading}
                  className="rounded-md border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "Analyzing..." : analysisSource === "lichess" ? "Analyze Lichess" : "Analyze Chess.com"}
                </button>
              )}
            </div>
            {analysisSource === "pgn" ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-white/10 bg-black/15 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Paste PGN</label>
                    {pgnText.trim() ? (
                      <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100">
                        {parsedPgnGames.length} game{parsedPgnGames.length === 1 ? "" : "s"} detected
                      </span>
                    ) : null}
                  </div>
                  <textarea
                    value={pgnText}
                    onChange={(event) => setPgnText(event.target.value)}
                    placeholder="Paste one or more PGNs here. Chess.com exports work well here too."
                    className="mt-2 h-32 w-full resize-none rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
                  />
                  {pgnText.trim() ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      {parsedPgnGames.length === 0
                        ? "We have not recognized any complete PGN games yet."
                        : parsedPgnGames.length === 1
                          ? "Only 1 game is currently loaded, so the analysis will be a little thin."
                          : `This PGN is ready to analyze across ${parsedPgnGames.length} detected games.`}
                    </p>
                  ) : null}
                </div>
                <div
                  onDragOver={handlePgnDragOver}
                  onDragLeave={handlePgnDragLeave}
                  onDrop={handlePgnDrop}
                  className={[
                    "rounded-lg border border-dashed p-4 transition",
                    isDraggingPgn
                      ? "border-violet-300/40 bg-violet-300/10"
                      : "border-white/10 bg-white/[0.02]"
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Drag, drop, or browse</label>
                      <p className="mt-2 text-sm text-zinc-300">
                        Drop a PGN export here, or browse for a `.pgn` file from Chess.com, Lichess, or your own database.
                      </p>
                    </div>
                    {pgnText.trim() ? (
                      <button
                        type="button"
                        onClick={() => setPgnText("")}
                        className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.05]"
                      >
                        Clear PGN
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="file"
                    accept=".pgn,text/plain"
                    onChange={handlePgnFileChange}
                    className="mt-4 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-violet-500/20 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-violet-100"
                  />
                  <p className="mt-3 text-xs text-zinc-500">
                    We&apos;ll analyze the games locally in the same way as your live account reports.
                  </p>
                </div>
              </div>
            ) : null}
            {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
            {isLoading && report ? (
              <p className="mt-2 text-sm text-sky-200">
                Refreshing report from the latest {analysisSource === "lichess" ? "Lichess" : "Chess.com"} games...
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {([20, 40, 100] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setGameCountFilter(count)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
                    gameCountFilter === count
                      ? "border-violet-300/40 bg-violet-300/10 text-violet-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  Last {count}
                </button>
              ))}
              {(["all", "rapid", "blitz", "bullet"] as const).map((timeClass) => (
                <button
                  key={timeClass}
                  type="button"
                  onClick={() => setTimeClassFilter(timeClass)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
                    timeClassFilter === timeClass
                      ? "border-sky-300/40 bg-sky-300/10 text-sky-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  {timeClass}
                </button>
              ))}
              {(["all", "white", "black"] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setColorFilter(color)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
                    colorFilter === color
                      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isLoading && !report ? (
        <AnalysisLoadingState />
      ) : !report ? (
        <section className="rounded-lg border border-dashed border-white/10 bg-zinc-950/40 p-6 text-sm text-zinc-400">
          {analysisSource === "pgn"
            ? "Paste or upload PGN, add the username used in those games, and run the analysis."
            : `Run a ${analysisSource === "lichess" ? "Lichess" : "Chess.com"} analysis to fill in the overview, openings, skills, and strengths panels.`}
        </section>
      ) : report.gamesAnalyzed === 0 ? (
        <section className="rounded-lg border border-dashed border-white/10 bg-zinc-950/40 p-6">
          <p className="text-sm font-semibold text-white">
            {analysisSource === "lichess"
              ? "We fetched games, but none of them matched this filter set."
              : analysisSource === "pgn"
                ? "The PGN loaded, but none of the games matched the current username and filters."
                : "We fetched Chess.com games, but none of them matched this filter set."}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {analysisSource === "lichess"
              ? "Try switching the color or time-class filters, or check whether this account mostly plays a different time control."
              : analysisSource === "pgn"
                ? "Double-check the username in the PGN headers, or widen the filters so the uploaded games can show up."
                : "Try widening the filters or switching to Lichess / PGN upload for a more stable long-term flow."}
          </p>
        </section>
      ) : (
        <>
          <section id="analysis-overview" className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Overview</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold text-white">{report.username}&apos;s game-analysis snapshot</h2>
                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                      analysisSource === "lichess"
                        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                        : analysisSource === "pgn"
                          ? "border-violet-300/30 bg-violet-300/10 text-violet-100"
                          : "border-amber-300/30 bg-amber-300/10 text-amber-100"
                    ].join(" ")}
                  >
                    {analysisSource === "lichess" ? "Lichess" : analysisSource === "pgn" ? "PGN upload" : "Chess.com prototype"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/20"
                >
                  Save snapshot
                </button>
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-300 transition hover:bg-white/[0.05]"
                >
                  Export report
                </button>
                <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-300">{report.gamesAnalyzed} games analyzed</span>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(380px,520px)_1fr]">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-base font-semibold uppercase tracking-[0.14em] text-zinc-300">Skill map</h3>
                <div className="mt-4 flex justify-center">
                  <RadarChart report={report} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-lg font-semibold text-white">Interpretation</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{report.summary}</p>
                  <div className="mt-4 space-y-3">
                    {report.metrics.map((metric) => (
                      <div key={metric.label} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                        <div className="min-w-0">
                          <MetricStatusLabel status={metric.status} />
                          <p className="text-sm font-semibold text-white">
                            {metric.label}: {metric.score}%
                          </p>
                          <p className="mt-1 text-sm leading-6 text-zinc-400">{metric.detail}</p>
                        </div>
                        <span
                          className={[
                            "rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                            metric.status === "strong"
                              ? "bg-emerald-300/10 text-emerald-200"
                              : metric.status === "warning"
                                ? "bg-rose-300/10 text-rose-200"
                                : "bg-violet-300/10 text-violet-200"
                          ].join(" ")}
                        >
                          {metric.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-violet-300/20 bg-violet-400/10 p-4">
                  <h3 className="text-lg font-semibold text-white">How to improve</h3>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {report.recommendations.map((recommendation) => (
                      <div key={recommendation.title} className="rounded-lg border border-white/10 bg-black/15 p-4">
                        <p className="text-sm font-semibold text-white">{recommendation.title}</p>
                        <p className="mt-2 text-sm leading-6 text-zinc-300">{recommendation.body}</p>
                        {recommendation.suggestedCourseIds.length ? (
                          <div className="mt-4 space-y-2">
                            {recommendation.suggestedCourseIds
                              .map((courseId) => availableCourses.find((course) => course.id === courseId))
                              .filter((course): course is OpeningCourse => Boolean(course))
                              .map((course) => (
                                <button
                                  key={course.id}
                                  type="button"
                                  onClick={() => onOpenCourseSuggestion(course.id)}
                                  className="w-full rounded-md border border-violet-300/20 bg-violet-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
                                >
                                  {recommendation.cta}: {course.name}
                                </button>
                              ))}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="mt-4 w-full rounded-md bg-violet-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
                          >
                            {recommendation.cta}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <ColorSummaryCard breakdown={report.byColor.white} />
              <ColorSummaryCard breakdown={report.byColor.black} />
            </div>

            <div className="mt-5">
              <SkillSpotlightsPanel report={report} comparison={peerComparison} />
            </div>

            <div className="mt-5">
              <WinRateBreakdownPanel report={report} />
            </div>

            <SnapshotComparePanel
              snapshots={relevantSnapshots}
              selectedSnapshotId={selectedSnapshotId}
              onSelectSnapshot={setSelectedSnapshotId}
              comparison={snapshotComparison}
            />

            <PeerComparisonPanel comparison={peerComparison} hasEnoughGames={report.gamesAnalyzed >= 10} />
          </section>

          <section id="analysis-openings" className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Openings</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Real patterns from your recent PGNs</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {report.openingPerformance.map((opening) => (
                <button
                  key={opening.name}
                  type="button"
                  onClick={() => setSelectedOpeningName(opening.name)}
                  className={[
                    "rounded-lg border p-4 text-left transition",
                    selectedOpeningExplorer?.name === opening.name
                      ? "border-sky-300/30 bg-sky-300/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">{opening.name}</h3>
                    <span className="rounded-full bg-sky-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
                      {opening.score}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-sky-300" style={{ width: `${opening.score}%` }} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded-full border border-white/10 px-2 py-1">{opening.games} games</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">{opening.wins}W</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">{opening.draws}D</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">{opening.losses}L</span>
                  </div>
                </button>
              ))}
            </div>

            {selectedOpeningExplorer ? (
              <div className="mt-5 rounded-lg border border-sky-300/15 bg-sky-300/[0.06] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">Opening explorer</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">{selectedOpeningExplorer.name}</h3>
                    <p className="mt-1 text-sm text-zinc-300">
                      {selectedOpeningExplorer.games} games | {selectedOpeningExplorer.score}% score in this opening
                    </p>
                  </div>
                  <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100">
                    Your own games
                  </span>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-lg border border-white/10 bg-black/15 p-4">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Common branches</h4>
                    <div className="mt-3 space-y-3">
                      {selectedOpeningExplorer.branches.length ? (
                        selectedOpeningExplorer.branches.map((branch) => (
                          <button
                            key={branch.name}
                            type="button"
                            onClick={() => setSelectedBranchName(branch.name)}
                            className={[
                              "block w-full rounded-md border px-3 py-3 text-left transition",
                              selectedBranch?.name === branch.name
                                ? "border-sky-300/30 bg-sky-300/10"
                                : "border-white/10 bg-black/20 hover:bg-white/[0.05]"
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-white">{branch.name}</p>
                              <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">{branch.games} games</span>
                            </div>
                            <p className="mt-2 text-xs text-zinc-400">
                              {branch.score}% score | {branch.wins}W {branch.draws}D {branch.losses}L
                            </p>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-zinc-400">We do not have enough repeated branches in this opening yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/15 p-4">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Branch drill-down</h4>
                    <div className="mt-3 space-y-3">
                      {selectedBranch ? (
                        <>
                          <div className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-white">{selectedBranch.name}</p>
                              <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">{selectedBranch.games} games</span>
                            </div>
                            <p className="mt-2 text-xs text-zinc-400">
                              {selectedBranch.score}% score | {selectedBranch.wins}W {selectedBranch.draws}D {selectedBranch.losses}L
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenWeaknessTarget(selectedBranch.name, inferColorFromExplorerExamples(selectedBranchExamples, report?.recentGames ?? []))}
                                className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-300/20"
                              >
                                Train this branch
                              </button>
                            </div>
                          </div>

                          <div className="rounded-md border border-white/10 bg-black/20 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Pawn breaks in this opening</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedOpeningExplorer.pawnBreaks.length ? (
                                selectedOpeningExplorer.pawnBreaks.map((pawnBreak) => (
                                  <span key={`${selectedOpeningExplorer.name}-${pawnBreak.name}`} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">
                                    {pawnBreak.name} · {pawnBreak.score}%
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-zinc-400">No recurring pawn-break pattern yet.</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Recent examples</p>
                            <div className="mt-3 space-y-3">
                              {selectedBranchExamples.length ? (
                                selectedBranchExamples.map((example, index) => (
                                  <RecentGameRow key={`${example.url ?? selectedBranch.name}-${index}`} game={example} />
                                ))
                              ) : selectedOpeningExplorer.examples.length ? (
                                selectedOpeningExplorer.examples.map((example, index) => (
                                  <RecentGameRow key={`${example.url ?? selectedOpeningExplorer.name}-${index}`} game={example} />
                                ))
                              ) : (
                                <p className="text-sm text-zinc-400">No recent examples are available for this opening yet.</p>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-400">Pick a branch to inspect the next layer down.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Most common move orders</h3>
                  <span className="text-xs text-zinc-500">First 8 plies from PGN</span>
                </div>
                <div className="mt-4 space-y-3">
                  {report.openingPaths.length ? (
                    report.openingPaths.map((path) => (
                      <div key={path.name} className="rounded-md border border-white/10 bg-black/15 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{path.name}</p>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">{path.games} games</span>
                        </div>
                        <p className="mt-2 text-xs text-zinc-400">
                          {path.wins}W {path.draws}D {path.losses}L
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-400">We did not get enough clean move-order data from this sample yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">Pawn break habits</h3>
                  <span className="text-xs text-zinc-500">Real moves you played</span>
                </div>
                <div className="mt-4 space-y-3">
                  {report.pawnBreaks.length ? (
                    report.pawnBreaks.map((pawnBreak) => (
                      <div key={pawnBreak.name} className="rounded-md border border-white/10 bg-black/15 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{pawnBreak.name}</p>
                          <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                            {pawnBreak.score}%
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-zinc-400">
                          Appeared in {pawnBreak.games} game{pawnBreak.games === 1 ? "" : "s"} | {pawnBreak.wins}W {pawnBreak.draws}D {pawnBreak.losses}L
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-400">No recurring pawn-break patterns stood out yet in the current sample.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <ColorPatternsPanel breakdown={report.byColor.white} />
              <ColorPatternsPanel breakdown={report.byColor.black} />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <TroubleSpotsPanel breakdown={report.byColor.white} onOpenWeaknessTarget={onOpenWeaknessTarget} availableCourses={availableCourses} />
              <TroubleSpotsPanel breakdown={report.byColor.black} onOpenWeaknessTarget={onOpenWeaknessTarget} availableCourses={availableCourses} />
            </div>
          </section>

          <section id="analysis-skills" className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Skills</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Patterns from the sample</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {report.recentPatterns.map((pattern) => (
                <div key={pattern} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  {pattern}
                </div>
              ))}
            </div>
          </section>

          {repertoireCoverage ? (
            <section className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.05] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Repertoire coverage</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">How often your real games hit your trained material</h2>
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-sm text-emerald-100">
                  {repertoireCoverage.coverage}% covered
                </span>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Coverage snapshot</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-300" style={{ width: `${repertoireCoverage.coverage}%` }} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Games in prep</p>
                      <p className="mt-2 text-lg font-semibold text-white">{repertoireCoverage.coveredGames}</p>
                    </div>
                    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Games outside prep</p>
                      <p className="mt-2 text-lg font-semibold text-white">{repertoireCoverage.uncoveredGames}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Most reached trained lines</p>
                  <div className="mt-3 space-y-2">
                    {repertoireCoverage.topCovered.length ? (
                      repertoireCoverage.topCovered.map((entry) => (
                        <div key={`${entry.courseId}-${entry.lineId}`} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{entry.lineName}</p>
                              <p className="mt-1 text-xs text-zinc-500">{entry.courseName}</p>
                            </div>
                            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">
                              {entry.games} games
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-400">No trained line has matched your recent games yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Coverage by side</p>
                  <div className="mt-3 space-y-3">
                    {([
                      { label: "White", data: repertoireCoverage.sideCoverage.white },
                      { label: "Black", data: repertoireCoverage.sideCoverage.black }
                    ] as const).map((entry) => (
                      <div key={entry.label} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{entry.label}</p>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">
                            {entry.data.coverage}% covered
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">
                          {entry.data.coveredGames} of {entry.data.games} game{entry.data.games === 1 ? "" : "s"} entered your prep
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Courses paying back</p>
                  <div className="mt-3 space-y-2">
                    {repertoireCoverage.strongestCourses.length ? (
                      repertoireCoverage.strongestCourses.map((course) => (
                        <div key={course.courseId} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-white">{course.courseName}</p>
                            <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                              {course.score}%
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-zinc-500">
                            {course.games} matched game{course.games === 1 ? "" : "s"} | {course.wins}W {course.draws}D {course.losses}L
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-400">No course has enough matched games yet to call it a reliable returning weapon.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Still not showing up</p>
                  <div className="mt-3 space-y-2">
                    {repertoireCoverage.coldCourses.length ? (
                      repertoireCoverage.coldCourses.map((course) => (
                        <div key={course.courseId} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                          <p className="truncate text-sm font-semibold text-white">{course.courseName}</p>
                          <p className="mt-2 text-xs text-zinc-500">
                            {course.lessonCount} lesson{course.lessonCount === 1 ? "" : "s"} | {course.repertoire} repertoire
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-400">Nice work. Every course in your library is showing up somewhere in your recent games.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Where you drift away</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {repertoireCoverage.uncoveredPatterns.length ? (
                    repertoireCoverage.uncoveredPatterns.map((pattern) => (
                      <button
                        key={pattern.name}
                        type="button"
                        onClick={() => onOpenWeaknessTarget(pattern.name, pattern.color)}
                        className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/20"
                      >
                        {pattern.name} · {pattern.games}
                      </button>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-400">Your recent games are staying pretty close to your trained material.</span>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <section id="analysis-strengths" className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Strengths and weaknesses</p>
            <h2 className="mt-2 text-xl font-semibold text-white">What stands out right now</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-emerald-300/15 bg-emerald-300/5 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-100">Strengths</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                  {report.strengths.map((strength) => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-rose-300/15 bg-rose-300/5 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-100">Weaknesses</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                  {report.weaknesses.map((weakness) => (
                    <li key={weakness}>{weakness}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Recent games</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Latest analyzed games</h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-400">
                {report.recentGames.length} shown
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {report.recentGames.map((game, index) => (
                <RecentGameRow key={`${game.url ?? game.opening}-${index}`} game={game} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AnalysisLoadingState() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-3">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-8 w-80 max-w-full" />
          </div>
          <SkeletonBlock className="h-9 w-40 rounded-full" />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <SkeletonBlock className="h-[320px] w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <SkeletonBlock className="h-6 w-40" />
              <div className="mt-4 space-y-3">
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-16 w-full" />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <SkeletonBlock className="h-40 w-full rounded-xl" />
              <SkeletonBlock className="h-40 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <div className="space-y-3">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-8 w-72 max-w-full" />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <SkeletonBlock className="h-52 w-full rounded-xl" />
          <SkeletonBlock className="h-52 w-full rounded-xl" />
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <div className="space-y-3">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-8 w-56 max-w-full" />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <SkeletonBlock className="h-36 w-full rounded-xl" />
          <SkeletonBlock className="h-36 w-full rounded-xl" />
          <SkeletonBlock className="h-36 w-full rounded-xl" />
        </div>
      </section>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

function PeerComparisonPanel({
  comparison,
  hasEnoughGames
}: {
  comparison: PeerComparison | null;
  hasEnoughGames: boolean;
}) {
  if (!hasEnoughGames) {
    return (
      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Compared with your rating range</h3>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">Need a bigger sample</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Once we have at least 10 games in the current filter, we can start comparing this report with other analyzed players in the same rating band.
        </p>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Compared with your rating range</h3>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">Building local baseline</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          We&apos;re ready for this comparison, but we still need more analyzed accounts in this rating range and filter combination before the peer view becomes meaningful.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Compared with your rating range</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Local peer baseline for {comparison.ratingBand} players around {comparison.averageRating}.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
          {comparison.sampleSize} peer sample{comparison.sampleSize === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {comparison.metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-white/10 bg-black/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">{metric.label}</p>
              <span
                className={[
                  "rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  metric.status === "above"
                    ? "bg-emerald-300/10 text-emerald-200"
                    : metric.status === "below"
                      ? "bg-rose-300/10 text-rose-200"
                      : "bg-zinc-300/10 text-zinc-200"
                ].join(" ")}
              >
                {metric.status === "above" ? "Above peers" : metric.status === "below" ? "Below peers" : "Around peers"}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-300">
              You: <span className="font-semibold text-white">{metric.playerScore}%</span> | Peers:{" "}
              <span className="font-semibold text-zinc-200">{metric.peerScore}%</span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {metric.delta >= 0 ? "+" : ""}
              {metric.delta} points versus your local comparison band.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarChart({ report }: { report: AnalysisReport }) {
  const labels = report.metrics.map((metric) => metric.label.replace(" performance", "").replace(" skill", ""));
  const values = report.metrics.map((metric) => metric.score);
  const size = 500;
  const center = size / 2;
  const radius = 125;
  const levels = 4;

  function pointFor(index: number, value: number) {
    const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
    const scaled = (value / 100) * radius;
    return {
      x: center + Math.cos(angle) * scaled,
      y: center + Math.sin(angle) * scaled
    };
  }

  const playerPoints = values.map((value, index) => pointFor(index, value));
  const playerPath = playerPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[460px] overflow-visible">
      {[...Array(levels)].map((_, index) => {
        const levelRadius = ((index + 1) / levels) * radius;
        const points = values
          .map((_, pointIndex) => {
            const angle = (Math.PI * 2 * pointIndex) / values.length - Math.PI / 2;
            return `${center + Math.cos(angle) * levelRadius},${center + Math.sin(angle) * levelRadius}`;
          })
          .join(" ");

        return <polygon key={levelRadius} points={points} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />;
      })}

      {labels.map((label, index) => {
        const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
        const horizontalBias = Math.cos(angle);
        const labelRadius = radius + (horizontalBias < -0.15 ? 62 : 52);
        const baseX = center + Math.cos(angle) * labelRadius;
        const y = center + Math.sin(angle) * labelRadius;
        const textAnchor = horizontalBias < -0.2 ? "end" : horizontalBias > 0.2 ? "start" : "middle";
        const x = horizontalBias < -0.2 ? baseX - 8 : horizontalBias > 0.2 ? baseX + 8 : baseX;

        return (
          <g key={label}>
            <line x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="rgba(255,255,255,0.08)" />
            <text x={x} y={y} textAnchor={textAnchor} className="fill-zinc-100 text-[15px] font-semibold">
              {label}
            </text>
          </g>
        );
      })}

      <polygon points={playerPath} fill="rgba(167,139,250,0.16)" stroke="rgba(167,139,250,0.95)" strokeWidth="3" />

      {playerPoints.map((point, index) => (
        <g key={`${labels[index]}-${values[index]}`}>
          <circle cx={point.x} cy={point.y} r="11" fill="rgb(139 92 246)" />
          <text x={point.x} y={point.y + 4} textAnchor="middle" className="fill-white text-[12px] font-semibold">
            {values[index]}
          </text>
        </g>
      ))}
    </svg>
  );
}

function MetricStatusLabel({ status }: { status: AnalysisReport["metrics"][number]["status"] }) {
  const copy =
    status === "strong"
      ? { label: "Strong", className: "text-emerald-200" }
      : status === "warning"
        ? { label: "Needs review", className: "text-rose-200" }
        : { label: "Review", className: "text-violet-200" };

  return <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${copy.className}`}>{copy.label}</p>;
}

function ColorSummaryCard({ breakdown }: { breakdown: AnalysisReport["byColor"]["white"] }) {
  const topOpening = breakdown.openingPerformance[0];
  const topBreak = breakdown.pawnBreaks[0];
  const colorLabel = breakdown.color === "white" ? "White" : "Black";
  const accentClass = breakdown.color === "white" ? "text-sky-200" : "text-amber-200";
  const badgeClass = breakdown.color === "white" ? "bg-sky-300/10 text-sky-100" : "bg-amber-300/10 text-amber-100";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${accentClass}`}>{colorLabel} split</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{breakdown.score}% score</h3>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}>
          {breakdown.games} games
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-black/15 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Top opening</p>
          <p className="mt-2 text-sm font-semibold text-white">{topOpening?.name ?? "No clear opening pattern yet"}</p>
          {topOpening ? <p className="mt-1 text-xs text-zinc-400">{topOpening.games} games | {topOpening.score}% score</p> : null}
        </div>
        <div className="rounded-md border border-white/10 bg-black/15 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Top pawn break</p>
          <p className="mt-2 text-sm font-semibold text-white">{topBreak?.name ?? "No recurring pawn break yet"}</p>
          {topBreak ? <p className="mt-1 text-xs text-zinc-400">{topBreak.games} games | {topBreak.score}% score</p> : null}
        </div>
      </div>
    </div>
  );
}

function WinRateBreakdownPanel({ report }: { report: AnalysisReport }) {
  const white = report.byColor.white;
  const black = report.byColor.black;
  const overall = {
    color: "overall" as const,
    games: white.games + black.games,
    wins: white.wins + black.wins,
    draws: white.draws + black.draws,
    losses: white.losses + black.losses
  };

  const rows = [
    {
      key: "white",
      label: "White",
      games: white.games,
      wins: white.wins,
      draws: white.draws,
      losses: white.losses
    },
    {
      key: "black",
      label: "Black",
      games: black.games,
      wins: black.wins,
      draws: black.draws,
      losses: black.losses
    },
    {
      key: "overall",
      label: "Overall",
      games: overall.games,
      wins: overall.wins,
      draws: overall.draws,
      losses: overall.losses
    }
  ].map((row) => {
    const total = Math.max(row.games, 1);
    return {
      ...row,
      winRate: Math.round((row.wins / total) * 100),
      drawRate: Math.round((row.draws / total) * 100),
      lossRate: Math.max(0, 100 - Math.round((row.wins / total) * 100) - Math.round((row.draws / total) * 100))
    };
  });

  const bestColor = [rows[0], rows[1]].reduce((best, current) => (current.winRate > best.winRate ? current : best), rows[0]);
  const swing = Math.abs(rows[0].winRate - rows[1].winRate);
  const weakerColorLabel = bestColor.key === "white" ? "Black" : "White";
  const overallRead =
    rows[2].winRate >= 75
      ? "You are absolutely dominating this sample. If you keep winning at this clip, you should be moving up rating groups fast."
      : rows[2].winRate >= 65
        ? "You are scoring really well here and may be a bit underrated right now if this level holds."
        : rows[2].winRate >= 55
          ? "You are on the right side of the sample and giving yourself plenty of chances to climb."
          : rows[2].winRate >= 50
            ? "The overall score is holding up, but there is still room to convert more of the playable games."
            : "This sample is pointing to a few leaks, so the main value here is identifying where the score is slipping away.";
  const whiteRead =
    rows[0].winRate >= 75
      ? "You are dominating with the White pieces right now. The positions are landing in your hands and you are cashing them in."
      : rows[0].winRate >= 65
        ? "White looks sharp. This is the side where your preparation is landing more cleanly."
        : rows[0].winRate >= rows[1].winRate + 8
          ? "White is currently your stronger side and it is giving you the cleaner results."
          : rows[0].winRate + 8 <= rows[1].winRate
            ? "White is lagging behind Black a bit, so this side probably deserves the first tune-up."
            : "White is staying fairly close to Black, which usually means the overall setup is holding together.";
  const blackRead =
    rows[1].winRate >= 75
      ? "Impressive work with the Black pieces. You are winning so often here that opponents are not really getting comfortable games."
      : rows[1].winRate >= 65
        ? "Black is looking strong. If you keep scoring like this, that side can become a real weapon."
        : rows[1].winRate >= rows[0].winRate + 8
          ? "Black is currently carrying the stronger score, which is a great sign if you have been investing in that repertoire."
          : rows[1].winRate + 8 <= rows[0].winRate
            ? "Black is the side that needs a little more support right now, especially in the repeat structures."
            : "Black is keeping pace with White, so the bigger story is probably consistency rather than one weak side.";
  const standoutRead =
    swing >= 10
      ? `There is a real split between the two colors here, with a ${swing}-point gap. I would treat your ${weakerColorLabel} repertoire as the first place to tighten up.`
      : swing >= 5
        ? `There is a mild tilt toward ${bestColor.label}, but not a dramatic one. This looks more like a refinement job than a rebuild.`
        : rows[2].winRate >= 65
          ? "The nice part is that both colors are holding up well, so this looks more like a player who is growing than one patching a major hole."
          : "Your White and Black results are close enough that the next gains probably come from specific branches and recurring positions rather than one entire side.";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Win rate</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Results by color</h3>
          <div className="mt-5 space-y-4">
            {rows.map((row) => (
              <div key={row.key} className="rounded-lg border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{row.label}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {row.games} games | {row.wins}W {row.draws}D {row.losses}L
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                    {row.winRate}% wins
                  </span>
                </div>
                <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-white/10">
                  <div className="flex items-center justify-center bg-emerald-300/80 text-[10px] font-semibold text-zinc-950" style={{ width: `${row.winRate}%` }}>
                    {row.winRate ? `${row.winRate}%` : ""}
                  </div>
                  <div className="flex items-center justify-center bg-zinc-200/70 text-[10px] font-semibold text-zinc-900" style={{ width: `${row.drawRate}%` }}>
                    {row.drawRate >= 8 ? `${row.drawRate}%` : ""}
                  </div>
                  <div className="flex items-center justify-center bg-rose-300/80 text-[10px] font-semibold text-zinc-950" style={{ width: `${row.lossRate}%` }}>
                    {row.lossRate >= 8 ? `${row.lossRate}%` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-300/80" />
              Win
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-zinc-200/70" />
              Draw
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-300/80" />
              Loss
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Interpretation</p>
          <div className="mt-4 space-y-4">
            <InterpretationNote
              title="Overall"
              body={`Across this sample, you are winning ${rows[2].winRate}% of your games and drawing ${rows[2].drawRate}%. ${overallRead}`}
            />
            <InterpretationNote
              title="With white pieces"
              body={`With White, you are converting ${rows[0].winRate}% of the sample. ${whiteRead}`}
            />
            <InterpretationNote
              title="With black pieces"
              body={`With Black, you are converting ${rows[1].winRate}% of the sample. ${blackRead}`}
            />
            <InterpretationNote
              title="What stands out"
              body={standoutRead}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InterpretationNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-6 text-zinc-300">{body}</p>
    </div>
  );
}

function SnapshotComparePanel({
  snapshots,
  selectedSnapshotId,
  onSelectSnapshot,
  comparison
}: {
  snapshots: SavedAnalysisSnapshot[];
  selectedSnapshotId: string | null;
  onSelectSnapshot: (snapshotId: string) => void;
  comparison: SnapshotComparison | null;
}) {
  if (!snapshots.length) {
    return (
      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Saved snapshots</h3>
            <p className="mt-1 text-sm text-zinc-400">Save checkpoints as you improve so we can compare this report against your own earlier work.</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">No snapshots yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Saved snapshots</h3>
          <p className="mt-1 text-sm text-zinc-400">
            Stack a few checkpoints over time, then compare the live report against an earlier moment from this same source.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
          {snapshots.length} saved snapshot{snapshots.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {snapshots.slice(0, 8).map((snapshot) => (
          <button
            key={snapshot.id}
            type="button"
            onClick={() => onSelectSnapshot(snapshot.id)}
            className={[
              "rounded-lg border px-4 py-3 text-left transition",
              selectedSnapshotId === snapshot.id
                ? "border-sky-300/30 bg-sky-300/10 text-sky-100 shadow-[0_0_0_1px_rgba(125,211,252,0.2)]"
                : "border-white/10 bg-black/15 text-zinc-300 hover:bg-white/[0.05]"
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{formatSnapshotDateShort(snapshot.capturedAt)}</p>
                <p className="mt-1 text-xs text-zinc-400">{formatSnapshotSourceLabel(snapshot.source)}</p>
              </div>
              {selectedSnapshotId === snapshot.id ? (
                <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
                  Selected
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
              <span className="rounded-full border border-white/10 px-2 py-1">{snapshot.gamesAnalyzed} games</span>
              <span className="rounded-full border border-white/10 px-2 py-1">{formatSnapshotFilterLabel(snapshot.filters)}</span>
            </div>
          </button>
        ))}
      </div>

      {comparison ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-lg border border-white/10 bg-black/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Checkpoint vs now</p>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">
                {formatSnapshotDateShort(comparison.baseline.capturedAt)} {"->"} now
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SnapshotFactCard
                label="Saved checkpoint"
                value={`${comparison.baseline.overallScore}%`}
                detail={`${comparison.baseline.gamesAnalyzed} games • ${formatSnapshotFilterLabel(comparison.baseline.filters)}`}
              />
              <SnapshotFactCard
                label="Current report"
                value={`${comparison.current.overallScore}%`}
                detail={`${comparison.current.gamesAnalyzed} games • ${formatSnapshotFilterLabel(comparison.current.filters)}`}
              />
              <SnapshotFactCard
                label="Overall swing"
                value={formatSignedPercent(comparison.deltas.overallScore)}
                detail="Current score versus the saved checkpoint"
              />
              <SnapshotFactCard
                label="Coverage"
                value={
                  comparison.current.repertoireCoverage !== null
                    ? `${comparison.current.repertoireCoverage.coverage}%`
                    : "No coverage"
                }
                detail={
                  comparison.deltas.coverage !== null
                    ? formatDeltaLine(comparison.deltas.coverage, "vs saved coverage")
                    : "Save another coverage-aware snapshot to compare this."
                }
              />
            </div>

            <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Coach read</p>
              <p className="mt-2 text-sm leading-6 text-zinc-200">{comparison.summary}</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/15 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Metric changes</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {comparison.metricDeltas.map((metric) => (
                <div key={metric.label} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{metric.label}</p>
                    <span className={getDeltaBadgeClass(metric.delta)}>
                      {formatSignedPercent(metric.delta)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">
                    Then {metric.baselineScore}% {"->"} now {metric.currentScore}%
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {comparison.colorDeltas.map((entry) => (
                <div key={entry.label} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{entry.label}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{entry.currentScore}%</p>
                  <p className="mt-1 text-xs text-zinc-400">{formatDeltaLine(entry.delta, "from saved snapshot")}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SnapshotFactCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-400">{detail}</p>
    </div>
  );
}

function TrendNote({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "positive" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
        : "border-white/10 bg-white/[0.03] text-zinc-200";

  return (
    <div className={`rounded-md border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SkillSpotlightsPanel({
  report,
  comparison
}: {
  report: AnalysisReport;
  comparison: PeerComparison | null;
}) {
  const spotlightLabels = ["Advantage capitalization", "Resourcefulness", "Tactical skill", "Time management"] as const;
  const spotlights = spotlightLabels
    .map((label) => buildSkillSpotlight(report, comparison, label))
    .filter((spotlight): spotlight is SkillSpotlight => Boolean(spotlight));

  if (!spotlights.length) {
    return null;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {spotlights.map((spotlight) => (
        <SkillSpotlightCard key={spotlight.label} spotlight={spotlight} />
      ))}
    </div>
  );
}

type SkillSpotlight = {
  label: string;
  score: number;
  peerScore: number | null;
  targetScore: number;
  peerLabel: string | null;
  status: AnalysisMetric["status"];
  detail: string;
  recommendation: string;
  comparisonLabel: string | null;
  interpretation: string;
  improvement: string;
};

function buildSkillSpotlight(
  report: AnalysisReport,
  comparison: PeerComparison | null,
  label: "Advantage capitalization" | "Resourcefulness" | "Tactical skill" | "Time management"
): SkillSpotlight | null {
  const metric = report.metrics.find((entry) => entry.label === label);

  if (!metric) {
    return null;
  }

  const peerMetric = comparison?.metrics.find((entry) => entry.label === label) ?? null;
  const targetScore =
    label === "Advantage capitalization"
      ? 75
      : label === "Resourcefulness"
        ? 55
        : label === "Tactical skill"
          ? 70
          : 72;
  const comparisonLabel = peerMetric && comparison ? `${comparison.ratingBand} peers` : null;
  const peerScore = peerMetric?.peerScore ?? null;
  const interpretation = buildSpotlightInterpretation(label, metric, peerMetric);
  const improvement =
    metric.status === "strong"
      ? `Keep pressing this edge. ${metric.recommendation}`
      : metric.status === "review"
        ? `This is close to solid already. ${metric.recommendation}`
        : `This is one of the cleaner places to pick up results fast. ${metric.recommendation}`;

  return {
    label,
    score: metric.score,
    peerScore,
    targetScore,
    peerLabel: comparisonLabel,
    status: metric.status,
    detail: metric.detail,
    recommendation: metric.recommendation,
    comparisonLabel,
    interpretation,
    improvement
  };
}

function buildSpotlightInterpretation(
  label: "Advantage capitalization" | "Resourcefulness" | "Tactical skill" | "Time management",
  metric: AnalysisMetric,
  peerMetric: PeerComparison["metrics"][number] | null
) {
  if (label === "Advantage capitalization") {
    if (metric.score >= 80) {
      return peerMetric && peerMetric.delta >= 6
        ? "You are doing a really good job cashing in the games where you should be favored. This is the kind of score that usually belongs to players moving up fast."
        : "You are converting your better chances well. When you get the edge, the score is usually ending up where it should."
    }

    if (metric.score >= 65) {
      return peerMetric && peerMetric.delta >= 0
        ? "You are converting a healthy share of your better games, and you are at least keeping pace with your rating band."
        : "The base is good here, but there are still a few wins leaking away in positions you should be able to bank."
    }

    return peerMetric && peerMetric.delta < 0
      ? "This is coming in below your rating band, which usually means better positions are not getting simplified cleanly enough yet."
      : "There is value here. You are getting chances, but not enough of the favorable ones are turning into full points.";
  }

  if (label === "Tactical skill") {
    if (metric.score >= 80) {
      return peerMetric && peerMetric.delta >= 6
        ? "Your tactical results are coming in well above your rating band. You are spotting enough of the sharp moments to really punish mistakes."
        : "Tactics looks like a real strength in this sample. When the game gets sharp, you are usually handling it well.";
    }

    if (metric.score >= 65) {
      return peerMetric && peerMetric.delta >= 0
        ? "The tactical side is in a good place. You are keeping pace with your peers and giving yourself enough direct chances to score."
        : "This is workable already, but there are still a few tactical moments getting left on the board.";
    }

    return peerMetric && peerMetric.delta < 0
      ? "This is landing below your rating band, which usually means the sharper positions are deciding too many games against you."
      : "The tactical score is a bit soft right now. A little more forcing-move work would probably pay off quickly.";
  }

  if (label === "Time management") {
    if (metric.score >= 82) {
      return peerMetric && peerMetric.delta >= 6
        ? "Your clock handling is excellent compared with your rating band. You are not just playing good positions, you are getting them played on time."
        : "Time management is a real plus here. You are keeping enough clock for the important decisions.";
    }

    if (metric.score >= 68) {
      return peerMetric && peerMetric.delta >= 0
        ? "The clock picture is healthy. You are managing your time well enough that it is not becoming the main story."
        : "This is mostly stable, but there are still a few spots where simpler choices would buy you more breathing room.";
    }

    return peerMetric && peerMetric.delta < 0
      ? "This is trailing your rating band, so the clock is probably costing you a few games that should stay playable."
      : "The clock is creating a little too much pressure right now. Cleaner routines in familiar positions should help settle this down.";
  }

  if (metric.score >= 60) {
    return peerMetric && peerMetric.delta >= 8
      ? "This is a real strength. You are fighting back in tougher games better than most players around your level."
      : "You are giving yourself practical chances even when the game gets uncomfortable. That is a valuable skill to carry.";
  }

  if (metric.score >= 45) {
    return peerMetric && peerMetric.delta >= 0
      ? "Resourcefulness is holding up reasonably well. You are still finding enough counterplay to stay alive in hard games."
      : "There are signs of resilience here, but the tougher games could still use a little more calm defense and practical counterplay.";
  }

  return peerMetric && peerMetric.delta < 0
    ? "This is currently trailing your rating band, so the tougher positions are probably snowballing too quickly once you are under pressure."
    : "Right now the harder games are slipping away a bit too fast. This is a good area to train if you want more save-and-swindle points.";
}

function SkillSpotlightCard({ spotlight }: { spotlight: SkillSpotlight }) {
  const bars = [
    {
      label: "You",
      value: spotlight.score,
      className: "bg-emerald-300/85 text-zinc-950"
    },
    ...(spotlight.peerScore !== null && spotlight.comparisonLabel
      ? [
          {
            label: "Peers",
            value: spotlight.peerScore,
            className: "bg-sky-300/75 text-zinc-950"
          }
        ]
      : []),
    {
      label: "Strong range",
      value: spotlight.targetScore,
      className: "bg-violet-300/75 text-zinc-950"
    }
  ];
  const statusClass =
    spotlight.status === "strong"
      ? "bg-emerald-300/10 text-emerald-100"
      : spotlight.status === "warning"
        ? "bg-rose-300/10 text-rose-100"
        : "bg-amber-300/10 text-amber-100";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Skill spotlight</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{spotlight.label}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${statusClass}`}>
          {spotlight.score}% score
        </span>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-white/10 bg-black/15 p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {spotlight.peerLabel
              ? `Comparing you against ${spotlight.peerLabel} and a strong benchmark`
              : "Comparing you against a strong benchmark while peer data builds up"}
          </p>
          <div
            className="grid items-end gap-3"
            style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
          >
            {bars.map((bar) => (
              <div key={bar.label} className="flex flex-col items-center gap-3">
                <div className="relative flex h-48 w-full items-end overflow-hidden rounded-t-md rounded-b-sm bg-white/[0.06]">
                  <div
                    className={`flex w-full items-center justify-center rounded-t-md text-sm font-semibold ${bar.className}`}
                    style={{ height: `${Math.max(10, Math.min(bar.value, 100))}%` }}
                  >
                    {bar.value}%
                  </div>
                </div>
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{bar.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">{spotlight.detail}</p>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/15 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Interpretation</p>
          <p className="mt-3 text-sm leading-7 text-zinc-200">{spotlight.interpretation}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">How to improve</p>
          <p className="mt-2 text-sm leading-7 text-zinc-300">{spotlight.improvement}</p>
        </div>
      </div>
    </div>
  );
}

function ColorPatternsPanel({ breakdown }: { breakdown: AnalysisReport["byColor"]["white"] }) {
  const colorLabel = breakdown.color === "white" ? "White repertoire" : "Black repertoire";
  const moveOrderLabel = breakdown.color === "white" ? "Your White move orders" : "Your Black move orders";
  const breakLabel = breakdown.color === "white" ? "Your White pawn breaks" : "Your Black pawn breaks";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">{colorLabel}</h3>
      <div className="mt-4 grid gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{moveOrderLabel}</p>
          <div className="mt-3 space-y-2">
            {breakdown.openingPaths.length ? (
              breakdown.openingPaths.map((path) => (
                <div key={`${breakdown.color}-${path.name}`} className="rounded-md border border-white/10 bg-black/15 px-3 py-3">
                  <p className="text-sm font-semibold text-white">{path.name}</p>
                  <p className="mt-1 text-xs text-zinc-400">{path.games} games | {path.wins}W {path.draws}D {path.losses}L</p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-400">No recurring move-order sample yet.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{breakLabel}</p>
          <div className="mt-3 space-y-2">
            {breakdown.pawnBreaks.length ? (
              breakdown.pawnBreaks.map((pawnBreak) => (
                <div key={`${breakdown.color}-${pawnBreak.name}`} className="rounded-md border border-white/10 bg-black/15 px-3 py-3">
                  <p className="text-sm font-semibold text-white">{pawnBreak.name}</p>
                  <p className="mt-1 text-xs text-zinc-400">{pawnBreak.games} games | {pawnBreak.score}% score</p>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-400">No recurring pawn-break sample yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TroubleSpotsPanel({
  breakdown,
  onOpenWeaknessTarget,
  availableCourses
}: {
  breakdown: AnalysisReport["byColor"]["white"];
  onOpenWeaknessTarget: (patternName: string, color: "white" | "black") => void;
  availableCourses: OpeningCourse[];
}) {
  const colorLabel = breakdown.color === "white" ? "White trouble spots" : "Black trouble spots";
  const openingLabel = breakdown.color === "white" ? "Weak White openings" : "Weak Black openings";
  const pathLabel = breakdown.color === "white" ? "Weak White branches" : "Weak Black branches";

  return (
    <div className="rounded-lg border border-rose-300/15 bg-rose-300/5 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-rose-100">{colorLabel}</h3>
      <div className="mt-4 grid gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-200/80">{openingLabel}</p>
          <div className="mt-3 space-y-2">
            {breakdown.weakestOpenings.length ? (
              breakdown.weakestOpenings.map((openingSpot) => (
                <TroubleSpotCard
                  key={`${breakdown.color}-weak-opening-${openingSpot.pattern.name}`}
                  label={openingSpot.pattern.name}
                  games={openingSpot.pattern.games}
                  wins={openingSpot.pattern.wins}
                  draws={openingSpot.pattern.draws}
                  losses={openingSpot.pattern.losses}
                  score={openingSpot.pattern.score}
                  color={breakdown.color}
                  onOpenWeaknessTarget={onOpenWeaknessTarget}
                  examples={openingSpot.examples}
                  availableCourses={availableCourses}
                />
              ))
            ) : (
              <p className="rounded-md border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-400">Not enough repeat opening data for a fair weakness call yet.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-200/80">{pathLabel}</p>
          <div className="mt-3 space-y-2">
            {breakdown.weakestOpeningPaths.length ? (
              breakdown.weakestOpeningPaths.map((pathSpot) => (
                <TroubleSpotCard
                  key={`${breakdown.color}-weak-path-${pathSpot.pattern.name}`}
                  label={pathSpot.pattern.name}
                  games={pathSpot.pattern.games}
                  wins={pathSpot.pattern.wins}
                  draws={pathSpot.pattern.draws}
                  losses={pathSpot.pattern.losses}
                  score={pathSpot.pattern.score}
                  color={breakdown.color}
                  onOpenWeaknessTarget={onOpenWeaknessTarget}
                  examples={pathSpot.examples}
                  availableCourses={availableCourses}
                />
              ))
            ) : (
              <p className="rounded-md border border-white/10 bg-black/15 px-3 py-3 text-sm text-zinc-400">Not enough repeat branch data for a fair weakness call yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TroubleSpotCard({
  label,
  games,
  wins,
  draws,
  losses,
  score,
  color,
  onOpenWeaknessTarget,
  examples,
  availableCourses
}: {
  label: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  color: "white" | "black";
  onOpenWeaknessTarget: (patternName: string, color: "white" | "black") => void;
  examples: AnalysisReport["byColor"]["white"]["weakestOpenings"][number]["examples"];
  availableCourses: OpeningCourse[];
}) {
  const matchedLine = findMatchedCourseLine(label, color, availableCourses);
  const matchLabel = matchedLine ? getCourseMatchLabel(matchedLine.score) : null;
  const coachingNote = buildTroubleSpotCoachingNote({
    label,
    color,
    games,
    wins,
    draws,
    losses,
    score,
    hasMatch: Boolean(matchedLine)
  });

  return (
    <div className="rounded-md border border-white/10 bg-black/15 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <span className="rounded-full bg-rose-300/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-200">
          {score}%
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        {games} games | {wins}W {draws}D {losses}L
      </p>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{coachingNote}</p>

      {matchedLine ? (
        <div className="mt-3 rounded-md border border-emerald-300/15 bg-emerald-300/5 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Matched line in your courses</p>
            {matchLabel ? (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                {matchLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Matched to</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {matchedLine.courseName} {"->"} {matchedLine.lineName}
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Course match</p>
          <p className="mt-2 text-sm text-zinc-400">No matching line found in your course library yet.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenWeaknessTarget(label, color)}
        className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-300/20"
      >
        {matchedLine ? "Open this training line" : "Train this weakness"}
      </button>
      <TroubleExamplesList examples={examples} />
    </div>
  );
}

function buildTroubleSpotCoachingNote({
  label,
  color,
  games,
  wins,
  draws,
  losses,
  score,
  hasMatch
}: {
  label: string;
  color: "white" | "black";
  games: number;
  wins: number;
  draws: number;
  losses: number;
  score: number;
  hasMatch: boolean;
}) {
  const sideLabel = color === "white" ? "White" : "Black";
  const lossRate = games ? Math.round((losses / games) * 100) : 0;
  const drawRate = games ? Math.round((draws / games) * 100) : 0;
  const resultRead =
    losses >= wins + 2
      ? `This branch is costing you too many points on the ${sideLabel} side right now.`
      : losses > wins
        ? `This branch is leaning the wrong way, even when the positions stay playable.`
        : drawRate >= 35
          ? `You are surviving this branch often enough, but not turning enough of those games into wins.`
          : `This is not collapsing every time, but it is still underperforming enough to deserve attention.`;
  const scoreRead =
    score <= 35
      ? "It looks like a real leak, not just a one-off wobble."
      : score <= 50
        ? "There is still enough resistance here that a targeted tune-up could pay off quickly."
        : "The score is middling, so the value is probably in sharpening the key move-order details.";
  const trainingRead = hasMatch
    ? `The good news is that we already have a matching training line for ${label}, so you can go straight from review into repair.`
    : `We do not have a direct training match for ${label} yet, so this is also a good candidate for expanding your course library.`;

  return `${resultRead} In ${games} games, you are scoring ${score}% here with a ${lossRate}% loss rate. ${scoreRead} ${trainingRead}`;
}

function findMatchedCourseLine(patternName: string, color: "white" | "black", availableCourses: OpeningCourse[]) {
  const targetTokens = tokenizeCoverageText(patternName);
  let bestMatch: { courseName: string; lineName: string; score: number } | null = null;

  for (const course of availableCourses) {
    if (!course || !Array.isArray(course.lines)) {
      continue;
    }

    for (const line of course.lines) {
      if (!line || !Array.isArray(line.moves)) {
        continue;
      }

      const haystack = [
        course.name,
        course.description,
        line.name,
        ...(line.analysisTags ?? []),
        ...(line.prelude?.map((move) => move.san) ?? []),
        ...line.moves.flatMap((move) => [move.san, move.prompt, move.explanation, move.plan, move.commonMistake ?? ""])
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;

      if (course.repertoire === color || line.sideToTrain === color) {
        score += 4;
      }

      if (haystack.includes(patternName.toLowerCase())) {
        score += 8;
      }

      for (const tag of line.analysisTags ?? []) {
        const normalizedTag = tag.toLowerCase();

        if (normalizedTag === patternName.toLowerCase()) {
          score += 12;
        }

        if (targetTokens.every((token) => normalizedTag.includes(token))) {
          score += 6;
        }
      }

      for (const token of targetTokens) {
        if (haystack.includes(token)) {
          score += token.length > 3 ? 2 : 1;
        }
      }

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          courseName: course.name,
          lineName: line.name,
          score
        };
      }
    }
  }

  return bestMatch && bestMatch.score > 0 ? bestMatch : null;
}

function getCourseMatchLabel(score: number): string {
  if (score >= 16) {
    return "Strong match";
  }

  if (score >= 9) {
    return "Good match";
  }

  return "Possible match";
}

function TroubleExamplesList({ examples }: { examples: AnalysisReport["byColor"]["white"]["weakestOpenings"][number]["examples"] }) {
  if (!examples.length) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Recent examples</p>
      {examples.map((example, index) => {
        const resultClass =
          example.result === "win" ? "text-emerald-200" : example.result === "loss" ? "text-rose-200" : "text-amber-200";
        const dateLabel = example.endTime ? new Date(example.endTime * 1000).toLocaleDateString() : null;

        return (
          <div key={`${example.url ?? example.openingPath}-${index}`} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
            <div className="min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-[0.12em] ${resultClass}`}>{example.result}</p>
              <p className="mt-1 truncate text-sm text-zinc-200">{example.opening}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {example.timeClass} | opp {example.opponentRating || "?"} {dateLabel ? `| ${dateLabel}` : ""}
              </p>
            </div>
            {example.url ? (
              <a
                href={example.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:bg-white/[0.05]"
              >
                Open
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RecentGameRow({ game }: { game: AnalysisReport["recentGames"][number] }) {
  const resultClass =
    game.result === "win" ? "bg-emerald-300/10 text-emerald-200" : game.result === "loss" ? "bg-rose-300/10 text-rose-200" : "bg-amber-300/10 text-amber-200";
  const dateLabel = game.endTime ? new Date(game.endTime * 1000).toLocaleDateString() : null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${resultClass}`}>{game.result}</span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">{game.timeClass}</span>
            {dateLabel ? <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">{dateLabel}</span> : null}
          </div>
          <p className="mt-2 text-sm font-semibold text-white">{game.opening}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {game.openingPath || "No branch label"} | opp {game.opponentRating || "?"}
          </p>
        </div>
        {game.url ? (
          <a
            href={game.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.05]"
          >
            Open game
          </a>
        ) : null}
      </div>
    </div>
  );
}

function filterAnalysisGames(
  games: ChessComGame[],
  username: string,
  timeClassFilter: "all" | "rapid" | "blitz" | "bullet",
  colorFilter: "all" | "white" | "black",
  gameCountFilter: 20 | 40 | 100
) {
  return games
    .filter((game) => {
      if (timeClassFilter !== "all" && game.time_class !== timeClassFilter) {
        return false;
      }

      if (colorFilter === "all") {
        return true;
      }

      const normalizedUsername = username.trim().toLowerCase();
      return colorFilter === "white"
        ? game.white?.username?.toLowerCase() === normalizedUsername
        : game.black?.username?.toLowerCase() === normalizedUsername;
    })
    .slice(0, gameCountFilter);
}

function getAveragePlayerRating(games: ChessComGame[], username: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const ratings = games
    .map((game) => {
      if (game.white?.username?.toLowerCase() === normalizedUsername) {
        return typeof game.white.rating === "number" ? game.white.rating : 0;
      }

      if (game.black?.username?.toLowerCase() === normalizedUsername) {
        return typeof game.black.rating === "number" ? game.black.rating : 0;
      }

      return 0;
    })
    .filter((rating) => rating > 0);

  if (!ratings.length) {
    return 0;
  }

  return Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);
}

function getRatingBand(rating: number) {
  const lowerBound = Math.floor(rating / 200) * 200;
  const upperBound = lowerBound + 199;
  return `${lowerBound}-${upperBound}`;
}

function readPeerSnapshots(): LocalPeerSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(analysisPeerStorageKey);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as LocalPeerSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildPeerComparison({
  snapshots,
  source,
  username,
  averageRating,
  report,
  timeClassFilter,
  colorFilter
}: {
  snapshots: LocalPeerSnapshot[];
  source: AnalysisSource;
  username: string;
  averageRating: number;
  report: AnalysisReport;
  timeClassFilter: "all" | "rapid" | "blitz" | "bullet";
  colorFilter: "all" | "white" | "black";
}): PeerComparison | null {
  const normalizedUsername = username.trim().toLowerCase();
  const ratingBand = getRatingBand(averageRating);
  const peers = snapshots.filter(
    (snapshot) =>
      snapshot.username !== normalizedUsername &&
      snapshot.source === source &&
      snapshot.ratingBand === ratingBand &&
      snapshot.timeClassFilter === timeClassFilter &&
      snapshot.colorFilter === colorFilter
  );

  if (peers.length < 2) {
    return null;
  }

  const metrics = report.metrics.map((metric) => {
    const peerScores = peers
      .map((peer) => peer.metrics.find((peerMetric) => peerMetric.label === metric.label)?.score ?? null)
      .filter((score): score is number => score !== null);

    const peerScore = peerScores.length
      ? Math.round(peerScores.reduce((sum, score) => sum + score, 0) / peerScores.length)
      : metric.score;
    const delta = metric.score - peerScore;

    return {
      label: metric.label,
      playerScore: metric.score,
      peerScore,
      delta,
      status: (delta >= 8 ? "above" : delta <= -8 ? "below" : "around") as "above" | "around" | "below"
    };
  });

  return {
    ratingBand,
    averageRating,
    sampleSize: peers.length,
    metrics
  };
}

function inferColorFromExplorerExamples(
  examples: AnalysisReport["recentGames"],
  fallbackGames: AnalysisReport["recentGames"]
): "white" | "black" {
  const source = examples[0] ?? fallbackGames[0];
  return /(?:^| )\.\.\./.test(source?.openingPath ?? "") ? "black" : "white";
}

type SnapshotComparison = {
  baseline: SavedAnalysisSnapshot;
  current: SavedAnalysisSnapshot;
  deltas: {
    overallScore: number;
    coverage: number | null;
  };
  metricDeltas: Array<{
    label: string;
    baselineScore: number;
    currentScore: number;
    delta: number;
  }>;
  colorDeltas: Array<{
    label: string;
    baselineScore: number;
    currentScore: number;
    delta: number;
  }>;
  biggestGain: {
    label: string;
    delta: number;
  } | null;
  biggestDrop: {
    label: string;
    delta: number;
  } | null;
  momentumLabel: string;
  momentumTone: "positive" | "warning" | "neutral";
  summary: string;
};

function buildSavedSnapshot({
  report,
  repertoireCoverage,
  analysisSource,
  averageRating,
  gameCountFilter,
  timeClassFilter,
  colorFilter
}: {
  report: AnalysisReport;
  repertoireCoverage: ReturnType<typeof buildRepertoireCoverage> | null;
  analysisSource: AnalysisSource;
  averageRating: number;
  gameCountFilter: 20 | 40 | 100;
  timeClassFilter: "all" | "rapid" | "blitz" | "bullet";
  colorFilter: "all" | "white" | "black";
}): SavedAnalysisSnapshot {
  return {
    id: `${report.username}-${analysisSource}-${Date.now()}`,
    username: report.username.trim().toLowerCase(),
    source: analysisSource,
    capturedAt: Date.now(),
    gamesAnalyzed: report.gamesAnalyzed,
    averageRating: averageRating || null,
    filters: {
      gameCountFilter,
      timeClassFilter,
      colorFilter
    },
    summary: report.summary,
    overallScore: getOverallScoreFromReport(report),
    overallWinRate: getOverallWinRateFromReport(report),
    byColor: {
      white: {
        score: report.byColor.white.score,
        wins: report.byColor.white.wins,
        draws: report.byColor.white.draws,
        losses: report.byColor.white.losses,
        games: report.byColor.white.games
      },
      black: {
        score: report.byColor.black.score,
        wins: report.byColor.black.wins,
        draws: report.byColor.black.draws,
        losses: report.byColor.black.losses,
        games: report.byColor.black.games
      }
    },
    metrics: report.metrics.map((metric) => ({
      label: metric.label,
      score: metric.score,
      detail: metric.detail
    })),
    topOpenings: report.openingPerformance.slice(0, 3).map((opening) => ({
      name: opening.name,
      score: opening.score,
      games: opening.games
    })),
    repertoireCoverage: repertoireCoverage
      ? {
          coverage: repertoireCoverage.coverage,
          coveredGames: repertoireCoverage.coveredGames,
          uncoveredGames: repertoireCoverage.uncoveredGames
        }
      : null
  };
}

function readSavedSnapshots(): SavedAnalysisSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(analysisSnapshotsStorageKey);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SavedAnalysisSnapshot[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildSnapshotComparison(
  report: AnalysisReport,
  repertoireCoverage: ReturnType<typeof buildRepertoireCoverage> | null,
  baseline: SavedAnalysisSnapshot,
  currentContext: {
    analysisSource: AnalysisSource;
    averageRating: number;
    gameCountFilter: 20 | 40 | 100;
    timeClassFilter: "all" | "rapid" | "blitz" | "bullet";
    colorFilter: "all" | "white" | "black";
  }
): SnapshotComparison {
  const current = buildSavedSnapshot({
    report,
    repertoireCoverage,
    analysisSource: currentContext.analysisSource,
    averageRating: currentContext.averageRating,
    gameCountFilter: currentContext.gameCountFilter,
    timeClassFilter: currentContext.timeClassFilter,
    colorFilter: currentContext.colorFilter
  });

  const metricDeltas = current.metrics.map((metric) => {
    const baselineMetric = baseline.metrics.find((entry) => entry.label === metric.label);
    const baselineScore = baselineMetric?.score ?? metric.score;

    return {
      label: metric.label,
      baselineScore,
      currentScore: metric.score,
      delta: metric.score - baselineScore
    };
  });

  const colorDeltas = [
    {
      label: "White",
      baselineScore: baseline.byColor.white.score,
      currentScore: current.byColor.white.score,
      delta: current.byColor.white.score - baseline.byColor.white.score
    },
    {
      label: "Black",
      baselineScore: baseline.byColor.black.score,
      currentScore: current.byColor.black.score,
      delta: current.byColor.black.score - baseline.byColor.black.score
    },
    {
      label: "Overall",
      baselineScore: baseline.overallScore,
      currentScore: current.overallScore,
      delta: current.overallScore - baseline.overallScore
    }
  ];

  const overallScoreDelta = current.overallScore - baseline.overallScore;
  const coverageDelta =
    current.repertoireCoverage && baseline.repertoireCoverage
      ? current.repertoireCoverage.coverage - baseline.repertoireCoverage.coverage
      : null;
  const strongestGain = [...metricDeltas].sort((left, right) => right.delta - left.delta)[0] ?? null;
  const largestLeak = [...metricDeltas].sort((left, right) => left.delta - right.delta)[0] ?? null;
  const momentum =
    overallScoreDelta >= 8
      ? { label: "Strong upward trend", tone: "positive" as const }
      : overallScoreDelta >= 2
        ? { label: "Quietly improving", tone: "positive" as const }
        : overallScoreDelta <= -8
          ? { label: "Needs a reset", tone: "warning" as const }
          : overallScoreDelta <= -2
            ? { label: "A little softer lately", tone: "warning" as const }
            : { label: "Holding steady", tone: "neutral" as const };

  return {
    baseline,
    current,
    deltas: {
      overallScore: overallScoreDelta,
      coverage: coverageDelta
    },
    metricDeltas,
    colorDeltas,
    biggestGain: strongestGain && strongestGain.delta > 0 ? { label: strongestGain.label, delta: strongestGain.delta } : null,
    biggestDrop: largestLeak && largestLeak.delta < 0 ? { label: largestLeak.label, delta: largestLeak.delta } : null,
    momentumLabel: momentum.label,
    momentumTone: momentum.tone,
    summary: buildSnapshotSummary({
        overallScoreDelta,
        coverageDelta,
        strongestGain,
        largestLeak
      })
  };
}

function getOverallScoreFromReport(report: AnalysisReport) {
  const whitePoints = report.byColor.white.wins + report.byColor.white.draws * 0.5;
  const blackPoints = report.byColor.black.wins + report.byColor.black.draws * 0.5;
  const totalGames = report.byColor.white.games + report.byColor.black.games;

  if (!totalGames) {
    return 0;
  }

  return Math.round(((whitePoints + blackPoints) / totalGames) * 100);
}

function getOverallWinRateFromReport(report: AnalysisReport) {
  const totalWins = report.byColor.white.wins + report.byColor.black.wins;
  const totalGames = report.byColor.white.games + report.byColor.black.games;

  if (!totalGames) {
    return 0;
  }

  return Math.round((totalWins / totalGames) * 100);
}

function buildSnapshotSummary({
  overallScoreDelta,
  coverageDelta,
  strongestGain,
  largestLeak
}: {
  overallScoreDelta: number;
  coverageDelta: number | null;
  strongestGain: SnapshotComparison["metricDeltas"][number] | null;
  largestLeak: SnapshotComparison["metricDeltas"][number] | null;
}) {
  if (overallScoreDelta >= 8) {
    return coverageDelta !== null && coverageDelta > 0
      ? `This is a meaningful jump. Your overall score is up ${overallScoreDelta} points and your repertoire coverage is also climbing, which usually means the training is sticking in real games.`
      : `This is a meaningful jump. Your overall score is up ${overallScoreDelta} points, so something in the recent work is landing better over the board.`;
  }

  if (overallScoreDelta <= -8) {
    return `This checkpoint is a little tougher than the saved one. The main thing to watch is ${largestLeak?.label ?? "your current weak spots"}, because that is where the slide is showing up most clearly.`;
  }

  if (strongestGain && strongestGain.delta >= 5) {
    return `The headline change is ${strongestGain.label.toLowerCase()}. That area is up ${strongestGain.delta} points, which is a good sign that your work there is starting to pay back.`;
  }

  if (largestLeak && largestLeak.delta <= -5) {
    return `The overall report is fairly close, but ${largestLeak.label.toLowerCase()} has slipped by ${Math.abs(largestLeak.delta)} points since the saved snapshot. That is probably the first thing I would revisit.`;
  }

  return coverageDelta !== null && coverageDelta !== 0
    ? `The scores are fairly steady, but your repertoire coverage moved ${coverageDelta > 0 ? "up" : "down"} by ${Math.abs(coverageDelta)} points. That usually means your games are either entering your prep more often or drifting away from it.`
    : "This comparison looks steady overall. You are in refinement territory now, where the next gains probably come from a few repeat branches rather than a dramatic rebuild.";
}

function formatSnapshotLabel(snapshot: SavedAnalysisSnapshot) {
  const date = new Date(snapshot.capturedAt);
  return `${date.toLocaleDateString()} · ${snapshot.gamesAnalyzed}g · ${snapshot.filters.timeClassFilter}`;
}

function formatSnapshotDateShort(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatSnapshotDate(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function formatSnapshotSourceLabel(source: AnalysisSource) {
  if (source === "lichess") {
    return "Lichess snapshot";
  }

  if (source === "pgn") {
    return "PGN upload snapshot";
  }

  return "Chess.com prototype snapshot";
}

function formatSnapshotFilterLabel(filters: SavedAnalysisSnapshot["filters"]) {
  const colorLabel = filters.colorFilter === "all" ? "both colors" : filters.colorFilter;
  return `${filters.gameCountFilter}g â€¢ ${filters.timeClassFilter} â€¢ ${colorLabel}`;
}

function formatDeltaLine(delta: number, suffix: string) {
  return `${delta >= 0 ? "+" : ""}${delta} ${suffix}`;
}

function formatSignedPercent(delta: number) {
  return `${delta >= 0 ? "+" : ""}${delta}%`;
}

function getDeltaBadgeClass(delta: number) {
  return [
    "rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
    delta >= 5
      ? "bg-emerald-300/10 text-emerald-200"
      : delta <= -5
        ? "bg-rose-300/10 text-rose-200"
        : "bg-zinc-300/10 text-zinc-200"
  ].join(" ");
}

function buildRepertoireCoverage(report: AnalysisReport, availableCourses: OpeningCourse[]) {
  const matcherEntries = availableCourses.flatMap((course) => {
    if (!course || !Array.isArray(course.lines)) {
      return [];
    }

    return course.lines
      .filter((line) => line && Array.isArray(line.moves))
      .map((line) => ({
        courseId: course.id,
        courseName: course.name,
        lineId: line.id,
        lineName: line.name,
        haystack: [
          course.name,
          course.description,
          line.name,
          ...(Array.isArray(line.analysisTags) ? line.analysisTags : []),
          ...(Array.isArray(line.prelude) ? line.prelude.map((move) => move.san) : []),
          ...line.moves.flatMap((move) => [move.san, move.prompt, move.explanation, move.plan, move.commonMistake ?? ""])
        ]
          .join(" ")
          .toLowerCase()
      }));
  });

  let coveredGames = 0;
  const topCoveredMap = new Map<string, { courseId: string; courseName: string; lineId: string; lineName: string; games: number }>();
  const coursePerformanceMap = new Map<
    string,
    { courseId: string; courseName: string; games: number; wins: number; draws: number; losses: number }
  >();
  const uncoveredMap = new Map<string, { name: string; games: number; color: "white" | "black" }>();
  const reachedCourseIds = new Set<string>();
  const sideCoverage = {
    white: { games: 0, coveredGames: 0 },
    black: { games: 0, coveredGames: 0 }
  };

  for (const game of report.recentGames) {
    const tokens = tokenizeCoverageText(`${game.opening} ${game.openingPath}`);
    const color = /(?:^| )\.\.\./.test(game.openingPath) ? "black" : "white";
    sideCoverage[color].games += 1;
    const bestMatch = matcherEntries.reduce<{ key: string; score: number; courseId: string; courseName: string; lineId: string; lineName: string } | null>((best, entry) => {
      let score = 0;

      for (const token of tokens) {
        if (entry.haystack.includes(token)) {
          score += token.length > 3 ? 2 : 1;
        }
      }

      if (entry.haystack.includes(game.opening.toLowerCase())) {
        score += 5;
      }

      if (entry.haystack.includes(game.openingPath.toLowerCase())) {
        score += 6;
      }

      if (!best || score > best.score) {
        return {
          key: `${entry.courseId}:${entry.lineId}`,
          score,
          courseId: entry.courseId,
          courseName: entry.courseName,
          lineId: entry.lineId,
          lineName: entry.lineName
        };
      }

      return best;
    }, null);

    if (bestMatch && bestMatch.score >= 5) {
      coveredGames += 1;
      sideCoverage[color].coveredGames += 1;
      reachedCourseIds.add(bestMatch.courseId);
      const current = topCoveredMap.get(bestMatch.key) ?? {
        courseId: bestMatch.courseId,
        courseName: bestMatch.courseName,
        lineId: bestMatch.lineId,
        lineName: bestMatch.lineName,
        games: 0
      };
      current.games += 1;
      topCoveredMap.set(bestMatch.key, current);
      const coursePerformance = coursePerformanceMap.get(bestMatch.courseId) ?? {
        courseId: bestMatch.courseId,
        courseName: bestMatch.courseName,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0
      };
      coursePerformance.games += 1;
      if (game.result === "win") {
        coursePerformance.wins += 1;
      } else if (game.result === "draw") {
        coursePerformance.draws += 1;
      } else {
        coursePerformance.losses += 1;
      }
      coursePerformanceMap.set(bestMatch.courseId, coursePerformance);
    } else {
      const patternName = game.openingPath || game.opening;
      const current = uncoveredMap.get(patternName) ?? { name: patternName, games: 0, color };
      current.games += 1;
      uncoveredMap.set(patternName, current);
    }
  }

  const gamesAnalyzed = report.recentGames.length;
  const coverage = gamesAnalyzed ? Math.round((coveredGames / gamesAnalyzed) * 100) : 0;
  const strongestCourses = Array.from(coursePerformanceMap.values())
    .map((course) => ({
      ...course,
      score: Math.round(((course.wins + course.draws * 0.5) / Math.max(course.games, 1)) * 100)
    }))
    .sort((left, right) => right.score - left.score || right.games - left.games)
    .slice(0, 3);
  const coldCourses = availableCourses
    .filter((course) => !reachedCourseIds.has(course.id))
    .map((course) => ({
      courseId: course.id,
      courseName: course.name,
      lessonCount: Array.isArray(course.lines) ? course.lines.length : 0,
      repertoire: course.repertoire
    }))
    .slice(0, 3);

  return {
    coverage,
    coveredGames,
    uncoveredGames: Math.max(0, gamesAnalyzed - coveredGames),
    sideCoverage: {
      white: {
        games: sideCoverage.white.games,
        coveredGames: sideCoverage.white.coveredGames,
        coverage: sideCoverage.white.games ? Math.round((sideCoverage.white.coveredGames / sideCoverage.white.games) * 100) : 0
      },
      black: {
        games: sideCoverage.black.games,
        coveredGames: sideCoverage.black.coveredGames,
        coverage: sideCoverage.black.games ? Math.round((sideCoverage.black.coveredGames / sideCoverage.black.games) * 100) : 0
      }
    },
    topCovered: Array.from(topCoveredMap.values()).sort((left, right) => right.games - left.games).slice(0, 4),
    strongestCourses,
    coldCourses,
    uncoveredPatterns: Array.from(uncoveredMap.values()).sort((left, right) => right.games - left.games).slice(0, 5)
  };
}

function tokenizeCoverageText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !["the", "and", "for", "with", "line", "main"].includes(token));
}

