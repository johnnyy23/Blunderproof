"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisPage } from "@/components/AnalysisPage";
import { AffiliateAdminPage } from "@/components/AffiliateAdminPage";
import { AppSidebar, type AppPage } from "@/components/AppSidebar";
import { Chessboard, getSelectableMoves } from "@/components/Chessboard";
import type { BoardAnnotations } from "@/components/BoardAnnotations";
import { CommunityPage } from "@/components/CommunityPage";
import { CommunityCourseShelf } from "@/components/CommunityCourseShelf";
import { CourseCatalog } from "@/components/CourseCatalog";
import { CourseLeaderboardCard, LeaderboardPage } from "@/components/LeaderboardPage";
import { LandingPage } from "@/components/LandingPage";
import { ManualCourseBuilder } from "@/components/ManualCourseBuilder";
import { PgnImporter } from "@/components/PgnImporter";
import { ProfileAccountSection } from "@/components/ProfileAccountSection";
import { StatCard } from "@/components/StatCard";
import { TrainerPanel } from "@/components/TrainerPanel";
import type { AuthUser } from "@/lib/auth";
import { courses, loadImportedCourses, saveImportedCourses } from "@/lib/courses";
import type { OpeningCourse, TrainingLine } from "@/lib/courses";
import { getGameStatus, getNextEnPassantTarget, getPiece, getUpdatedCastlingRights, makeMove, moveToUci, parseFen, parseUciMove, sameSquare } from "@/lib/chess";
import { sortCommunityCoursesByEngagement } from "@/lib/manualCourses";
import { type LeaderboardRange, loadCoursePlayEvents, recordCoursePlay } from "@/lib/leaderboards";
import { playTrainerSound } from "@/lib/trainerSounds";
import type { ReferralAttribution } from "@/lib/affiliates";
import {
  accuracy,
  getDueLines,
  getLineStatus,
  getMistakeReviewLines,
  getRecentActivity,
  getCurrentTrainingMove,
  initialProgress,
  isExpectedMove,
  loadStoredProgress,
  nextLineIndex,
  previousLineIndex,
  reviewedLineCount,
  saveStoredProgress,
  rescheduleLineForGrade,
  touchDailyStreak,
  updateProgressForAnswer,
  updateProgressForReveal
} from "@/lib/trainer";
import type { Board, CastlingRights, ChessMove, PieceColor, PieceType, ReviewGrade, Square, TrainingStatus } from "@/types/chess";

type BoardState = {
  board: Board;
  turn: PieceColor;
  castlingRights: CastlingRights;
  enPassantTarget: Square | null;
};

type HomeView = AppPage | "landing";

type PendingPromotion = {
  from: Square;
  to: Square;
};

type TrainingMode = "study" | "test";

type RemoteUserProgress = {
  course_id: string;
  line_id: string;
  status: TrainingStatus;
  last_move_index: number | null;
  updated_at?: string;
};

type ProgressSaveState = "idle" | "saving" | "saved" | "error";

const trainingModeStorageKey = "blounderproof:training-mode:v1";
const trainingSoundStorageKey = "blounderproof:training-sound:v1";
const localProfileStorageKey = "blounderproof:local-profile:v1";
const boardThemeStorageKey = "blounderproof:board-theme:v1";
const referralAttributionStorageKey = "blounderproof:referral-attribution:v1";
const analysisSections = [
  { id: "overview", label: "Overview" },
  { id: "openings", label: "Openings" },
  { id: "skills", label: "Skills" },
  { id: "strengths", label: "Strengths" }
];

type LocalProfile = {
  name: string;
  email: string;
};

type ReferralBanner = {
  affiliateName: string;
  referralCode: string;
} | null;

type ProfileSettingsPanel = "membership" | null;

type BoardTheme = {
  id: string;
  name: string;
  light: string;
  dark: string;
};

const boardThemes: BoardTheme[] = [
  { id: "classic", name: "Classic", light: "#ecd8b0", dark: "#c9a477" },
  { id: "sage", name: "Sage", light: "#c8d7a6", dark: "#58745a" },
  { id: "slate", name: "Slate", light: "#cfd5de", dark: "#66758a" },
  { id: "ember", name: "Ember", light: "#e6c6a5", dark: "#9b684c" }
];

const profilePreviewBoard = parseFen("rnbqkbnr/pppp1ppp/8/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 2 4").board;

function isTrainingStatus(value: unknown): value is TrainingStatus {
  return value === "idle" || value === "correct" || value === "incorrect" || value === "revealed";
}

function createBoardState(fen: string): BoardState {
  const parsed = parseFen(fen);
  return {
    board: parsed.board,
    turn: parsed.turn,
    castlingRights: parsed.castlingRights,
    enPassantTarget: parsed.enPassantTarget
  };
}

function applyPrelude(line: TrainingLine): { boardState: BoardState; moveHistory: string[] } {
  const boardState = createBoardState(line.fen);
  const moveHistory: string[] = [];

  for (const preludeMove of line.prelude ?? []) {
    const { from, to, promotion } = parseUciMove(preludeMove.uci);
    const previousBoard = boardState.board;
    const previousCastlingRights = boardState.castlingRights;
    const result = makeMove(boardState.board, from, to, {
      promotion,
      castlingRights: boardState.castlingRights,
      enPassantTarget: boardState.enPassantTarget
    });

    if (!result) {
      break;
    }

    boardState.board = result.board;
    boardState.turn = boardState.turn === "white" ? "black" : "white";
    boardState.castlingRights = getUpdatedCastlingRights(previousBoard, from, to, previousCastlingRights);
    boardState.enPassantTarget = getNextEnPassantTarget(previousBoard, from, to);
    moveHistory.push(preludeMove.san);
  }

  return { boardState, moveHistory };
}

function prepareLineAtMove(line: TrainingLine, targetMoveIndex: number): { boardState: BoardState; moveHistory: string[] } {
  const prepared = applyPrelude(line);
  let boardState = prepared.boardState;
  const moveHistory = [...prepared.moveHistory];

  for (let index = 0; index < targetMoveIndex; index += 1) {
    const trainingMove = line.moves[index];

    if (!trainingMove) {
      break;
    }

    const nextMoveState = applyUciToBoardState(boardState, trainingMove.uci);

    if (!nextMoveState) {
      break;
    }

    boardState = nextMoveState;
    moveHistory.push(trainingMove.san);

    if (!trainingMove.opponentReply) {
      continue;
    }

    const nextReplyState = applyUciToBoardState(boardState, trainingMove.opponentReply.uci);

    if (!nextReplyState) {
      break;
    }

    boardState = nextReplyState;
    moveHistory.push(trainingMove.opponentReply.san);
  }

  return { boardState, moveHistory };
}

function applyUciToBoardState(boardState: BoardState, uci: string): BoardState | null {
  const { from, to, promotion } = parseUciMove(uci);
  const previousBoard = boardState.board;
  const previousCastlingRights = boardState.castlingRights;
  const result = makeMove(boardState.board, from, to, {
    promotion,
    castlingRights: boardState.castlingRights,
    enPassantTarget: boardState.enPassantTarget
  });

  if (!result) {
    return null;
  }

  return {
    board: result.board,
    turn: boardState.turn === "white" ? "black" : "white",
    castlingRights: getUpdatedCastlingRights(previousBoard, from, to, previousCastlingRights),
    enPassantTarget: getNextEnPassantTarget(previousBoard, from, to)
  };
}

function buildReplaySnapshots(line: TrainingLine): BoardState[] {
  const snapshots: BoardState[] = [];
  let current = createBoardState(line.fen);
  snapshots.push(current);

  for (const preludeMove of line.prelude ?? []) {
    const next = applyUciToBoardState(current, preludeMove.uci);

    if (!next) {
      return snapshots;
    }

    current = next;
    snapshots.push(current);
  }

  for (const move of line.moves) {
    const nextMove = applyUciToBoardState(current, move.uci);

    if (!nextMove) {
      return snapshots;
    }

    current = nextMove;
    snapshots.push(current);

    if (!move.opponentReply) {
      continue;
    }

    const nextReply = applyUciToBoardState(current, move.opponentReply.uci);

    if (!nextReply) {
      return snapshots;
    }

    current = nextReply;
    snapshots.push(current);
  }

  return snapshots;
}

export default function Home() {
  const [currentPage, setCurrentPage] = useState<HomeView>("courses");
  const [authEntryMode, setAuthEntryMode] = useState<"signin" | "signup">("signin");
  const [activeAnalysisSection, setActiveAnalysisSection] = useState("overview");
  const [isCompactCourseSidebar, setIsCompactCourseSidebar] = useState(false);
  const [isCompactAnalysisSidebar, setIsCompactAnalysisSidebar] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [activeCourseId, setActiveCourseId] = useState(courses[0].id);
  const [importedCourses, setImportedCourses] = useState<OpeningCourse[]>([]);
  const allCourses = useMemo(
    () => [...courses, ...importedCourses].filter(hasUsableCourse),
    [importedCourses]
  );
  const filteredCourses = useMemo(() => filterCourseCatalog(allCourses, courseSearchQuery), [allCourses, courseSearchQuery]);
  const communityCourses = useMemo(
    () => sortCommunityCoursesByEngagement(importedCourses.filter((course) => course.isShared)),
    [importedCourses]
  );
  const activeCourse = useMemo(() => allCourses.find((course) => course.id === activeCourseId) ?? allCourses[0], [activeCourseId, allCourses]);
  const [lineIndex, setLineIndex] = useState(0);
  const activeLine = activeCourse.lines[lineIndex] ?? activeCourse.lines[0];
  const [boardState, setBoardState] = useState<BoardState>(() => createBoardState(activeLine.fen));
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [status, setStatus] = useState<TrainingStatus>("idle");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [progress, setProgress] = useState(initialProgress);
  const [hasLoadedProgress, setHasLoadedProgress] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [hintedSquare, setHintedSquare] = useState<Square | null>(null);
  const [revealedSquare, setRevealedSquare] = useState<Square | null>(null);
  const [computerSquare, setComputerSquare] = useState<Square | null>(null);
  const [computerTargetSquare, setComputerTargetSquare] = useState<Square | null>(null);
  const [mistakenSquare, setMistakenSquare] = useState<Square | null>(null);
  const [correctSquare, setCorrectSquare] = useState<Square | null>(null);
  const [trainerAnnotations, setTrainerAnnotations] = useState<BoardAnnotations | undefined>(undefined);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>("study");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [localProfile, setLocalProfile] = useState<LocalProfile>({ name: "Blounderproof player", email: "" });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authPrompt, setAuthPrompt] = useState("");
  const [referralAttribution, setReferralAttribution] = useState<ReferralBanner>(null);
  const [profileSettingsPanel, setProfileSettingsPanel] = useState<ProfileSettingsPanel>(null);
  const [boardThemeId, setBoardThemeId] = useState("classic");
  const [playEvents, setPlayEvents] = useState(loadCoursePlayEvents);
  const [leaderboardRange, setLeaderboardRange] = useState<LeaderboardRange>("all");
  const [courseLeaderboardRange, setCourseLeaderboardRange] = useState<LeaderboardRange>("all");
  const [membershipPlanDraft, setMembershipPlanDraft] = useState<"free" | "pro" | "team">("free");
  const [membershipBillingCycleDraft, setMembershipBillingCycleDraft] = useState<"monthly" | "yearly" | "team">("monthly");
  const [membershipBillingEmailDraft, setMembershipBillingEmailDraft] = useState("");
  const [membershipMessage, setMembershipMessage] = useState("");
  const [membershipError, setMembershipError] = useState("");
  const [isSavingMembership, setIsSavingMembership] = useState(false);
  const [showCompletionConfetti, setShowCompletionConfetti] = useState(false);
  const [completionConfettiKey, setCompletionConfettiKey] = useState(0);
  const [remoteProgressByLine, setRemoteProgressByLine] = useState<Record<string, RemoteUserProgress>>({});
  const [remoteProgressAllByLine, setRemoteProgressAllByLine] = useState<Record<string, RemoteUserProgress>>({});
  const progressSaveTimeoutRef = useRef<number | null>(null);
  const pendingProgressSaveRef = useRef<{ courseId: string; lineId: string; status: TrainingStatus; lastMoveIndex: number } | null>(null);
  const lastAttemptedProgressSaveRef = useRef<{ courseId: string; lineId: string; status: TrainingStatus; lastMoveIndex: number } | null>(null);
  const [progressSaveState, setProgressSaveState] = useState<ProgressSaveState>("idle");
  const [progressSaveError, setProgressSaveError] = useState<string>("");
  const progressSaveIndicatorTimeoutRef = useRef<number | null>(null);

  const currentMove = getCurrentTrainingMove(activeLine, moveIndex);
  const replaySnapshots = useMemo(() => buildReplaySnapshots(activeLine), [activeLine]);

  const lastProgressEntry = useMemo(() => {
    const entries = Object.values(remoteProgressAllByLine);
    if (entries.length === 0) {
      return null;
    }

    const sorted = entries
      .filter((entry) => entry && typeof entry.course_id === "string" && typeof entry.line_id === "string")
      .sort((left, right) => (right.updated_at ?? "").localeCompare(left.updated_at ?? ""));

    return sorted[0] ?? null;
  }, [remoteProgressAllByLine]);

  const isLineComplete = status === "correct" && moveIndex === activeLine.moves.length - 1;
  const displayedBoardState = replayIndex !== null ? replaySnapshots[Math.min(replayIndex, replaySnapshots.length - 1)] ?? boardState : boardState;
  const dueLinesForCourse = useMemo(() => getDueLines(activeCourse, progress), [activeCourse, progress]);
  const mistakeLinesForCourse = useMemo(() => getMistakeReviewLines(activeCourse, progress), [activeCourse, progress]);
  const activeLineStatus = useMemo(() => getLineStatus(activeLine, progress), [activeLine, progress]);
  const canUndoMove = status === "idle" && moveIndex > 0;
  const canGoPreviousLine = activeCourse.lines.length > 1;

  useEffect(() => {
    setProgress(touchDailyStreak(loadStoredProgress()));
    setImportedCourses(loadImportedCourses());
    setTrainingMode(loadTrainingMode());
    setSoundEnabled(loadSoundEnabled());
    setLocalProfile(loadLocalProfile());
    setBoardThemeId(loadBoardThemeId());
    setPlayEvents(loadCoursePlayEvents());
    setReferralAttribution(loadStoredReferralAttribution());
    setHasLoadedProgress(true);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAuthSession() {
      try {
        const response = await fetch("/api/auth/session");
        const payload = (await response.json()) as { user?: AuthUser | null };

        if (!isMounted) {
          return;
        }

        const user = payload.user ?? null;
        setAuthUser(user);

        if (user) {
          setLocalProfile({
            name: user.name,
            email: user.email
          });
          setCurrentPage((current) => (current === "landing" ? "courses" : current));
        }
      } catch {
        if (isMounted) {
          setAuthUser(null);
        }
      }
    }

    void loadAuthSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isMounted = true;

    async function loadRemoteProgress() {
      if (!authUser) {
        if (isMounted) {
          setRemoteProgressByLine({});
        }
        return;
      }

      try {
        const response = await fetch(`/api/progress/get?course_id=${encodeURIComponent(activeCourseId)}`);
        const payload = (await response.json()) as { progress?: unknown };

        if (!isMounted) {
          return;
        }

        if (!response.ok || !Array.isArray(payload.progress)) {
          return;
        }

        const next: Record<string, RemoteUserProgress> = {};

        for (const entry of payload.progress as unknown[]) {
          if (!entry || typeof entry !== "object") {
            continue;
          }

          const record = entry as Partial<RemoteUserProgress>;
          if (typeof record.course_id !== "string" || typeof record.line_id !== "string") {
            continue;
          }

          next[`${record.course_id}:${record.line_id}`] = {
            course_id: record.course_id,
            line_id: record.line_id,
            status: isTrainingStatus(record.status) ? record.status : "idle",
            last_move_index: typeof record.last_move_index === "number" ? record.last_move_index : null,
            updated_at: typeof (record as any).updated_at === "string" ? (record as any).updated_at : undefined
          };
        }

        setRemoteProgressByLine(next);

        if (currentPage === "course") {
          const restored = next[`${activeCourseId}:${activeLine.id}`];
          if (restored) {
            const restoredMoveIndex =
              typeof restored.last_move_index === "number"
                ? Math.max(0, Math.min(restored.last_move_index, activeLine.moves.length - 1))
                : 0;
            const prepared = restoredMoveIndex > 0 ? prepareLineAtMove(activeLine, restoredMoveIndex) : applyPrelude(activeLine);

            setBoardState(prepared.boardState);
            setSelectedSquare(null);
            setLegalMoves([]);
            setMoveIndex(restoredMoveIndex);
            setStatus(restored.status);
            setMoveHistory(prepared.moveHistory);
            setPendingPromotion(null);
            setHintedSquare(null);
            setRevealedSquare(null);
            setComputerSquare(null);
            setComputerTargetSquare(null);
            setMistakenSquare(null);
            setCorrectSquare(null);
            setTrainerAnnotations(undefined);
            setReplayIndex(null);
          }
        }
      } catch {
        if (isMounted) {
          setRemoteProgressByLine({});
        }
      }
    }

    void loadRemoteProgress();

    return () => {
      isMounted = false;
    };
  }, [activeCourseId, authUser, currentPage]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isMounted = true;

    async function loadAllRemoteProgress() {
      if (!authUser) {
        if (isMounted) {
          setRemoteProgressAllByLine({});
        }
        return;
      }

      try {
        const response = await fetch("/api/progress/get");
        const payload = (await response.json()) as { progress?: unknown };

        if (!isMounted) {
          return;
        }

        if (!response.ok || !Array.isArray(payload.progress)) {
          return;
        }

        const next: Record<string, RemoteUserProgress> = {};

        for (const entry of payload.progress as unknown[]) {
          if (!entry || typeof entry !== "object") {
            continue;
          }

          const record = entry as Partial<RemoteUserProgress>;
          if (typeof record.course_id !== "string" || typeof record.line_id !== "string") {
            continue;
          }

          next[`${record.course_id}:${record.line_id}`] = {
            course_id: record.course_id,
            line_id: record.line_id,
            status: isTrainingStatus(record.status) ? record.status : "idle",
            last_move_index: typeof record.last_move_index === "number" ? record.last_move_index : null,
            updated_at: typeof (record as any).updated_at === "string" ? (record as any).updated_at : undefined
          };
        }

        setRemoteProgressAllByLine(next);
      } catch {
        if (isMounted) {
          setRemoteProgressAllByLine({});
        }
      }
    }

    void loadAllRemoteProgress();

    return () => {
      isMounted = false;
    };
  }, [authUser]);

  useEffect(() => {
    if (typeof window === "undefined" || !authUser) {
      return;
    }

    const url = new URL(window.location.href);
    const checkoutState = url.searchParams.get("checkout");

    if (checkoutState === "cancel") {
      setCurrentPage("profile");
      setProfileSettingsPanel("membership");
      setMembershipMessage("Checkout was canceled. Your account is unchanged and you can try again whenever you're ready.");
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    if (checkoutState !== "success") {
      return;
    }

    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      setMembershipError("Stripe came back without a session ID. Try checkout again.");
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    let isMounted = true;

    async function confirmCheckout() {
      try {
        const response = await fetch("/api/auth/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId })
        });
        const payload = (await response.json()) as { user?: AuthUser; error?: string };

        if (!isMounted) {
          return;
        }

        if (!response.ok || !payload.user) {
          throw new Error(payload.error || "Could not confirm Stripe checkout.");
        }

        setAuthUser(payload.user);
        setCurrentPage("profile");
        setProfileSettingsPanel("membership");
        setMembershipMessage("Stripe checkout is connected. Your billing profile has been updated.");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCurrentPage("profile");
        setProfileSettingsPanel("membership");
        setMembershipError(error instanceof Error ? error.message : "Could not confirm Stripe checkout.");
      } finally {
        url.searchParams.delete("checkout");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.toString());
      }
    }

    void confirmCheckout();

    return () => {
      isMounted = false;
    };
  }, [authUser]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isMounted = true;
    const url = new URL(window.location.href);
    const referralCode = url.searchParams.get("ref");

    async function syncReferralAttribution() {
      try {
        const requestInit = referralCode
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ref: referralCode,
                landingPage: `${url.pathname}${url.search}`,
                utmSource: url.searchParams.get("utm_source"),
                utmMedium: url.searchParams.get("utm_medium"),
                utmCampaign: url.searchParams.get("utm_campaign"),
                utmContent: url.searchParams.get("utm_content"),
                utmTerm: url.searchParams.get("utm_term")
              })
            }
          : undefined;

        const response = await fetch("/api/affiliates/referral", requestInit);
        const payload = (await response.json()) as {
          attribution?: ReferralAttribution | null;
          affiliate?: { name: string; referralCode: string } | null;
        };

        if (!isMounted) {
          return;
        }

        const nextAttribution =
          payload.attribution && payload.affiliate
            ? {
                affiliateName: payload.affiliate.name,
                referralCode: payload.affiliate.referralCode
              }
            : payload.attribution
              ? {
                  affiliateName: payload.attribution.affiliateName,
                  referralCode: payload.attribution.referralCode
                }
              : null;

        setReferralAttribution(nextAttribution);
        saveStoredReferralAttribution(nextAttribution);
      } catch {
        if (isMounted) {
          setReferralAttribution(loadStoredReferralAttribution());
        }
      }
    }

    void syncReferralAttribution();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (hasLoadedProgress) {
      saveStoredProgress(progress);
      saveImportedCourses(importedCourses);
      saveTrainingMode(trainingMode);
      saveSoundEnabled(soundEnabled);
      saveLocalProfile(localProfile);
      saveBoardThemeId(boardThemeId);
    }
  }, [boardThemeId, hasLoadedProgress, importedCourses, localProfile, progress, soundEnabled, trainingMode]);

  useEffect(() => {
    setMembershipPlanDraft(authUser?.membershipPlan ?? "free");
    setMembershipBillingCycleDraft(authUser?.billingCycle ?? "monthly");
    setMembershipBillingEmailDraft(authUser?.billingEmail ?? authUser?.email ?? localProfile.email);
  }, [authUser, localProfile.email]);

  useEffect(() => {
    if (membershipPlanDraft === "free") {
      setMembershipBillingCycleDraft("monthly");
      return;
    }

    if (membershipPlanDraft === "team") {
      setMembershipBillingCycleDraft("team");
      return;
    }

    if (membershipBillingCycleDraft === "team") {
      setMembershipBillingCycleDraft("monthly");
    }
  }, [membershipBillingCycleDraft, membershipPlanDraft]);

  useEffect(() => {
    if (isLineComplete) {
      setReplayIndex(replaySnapshots.length - 1);
      return;
    }

    setReplayIndex(null);
  }, [isLineComplete, replaySnapshots.length]);

  useEffect(() => {
    if (!isLineComplete) {
      setShowCompletionConfetti(false);
      return;
    }

    setCompletionConfettiKey((current) => current + 1);
    setShowCompletionConfetti(true);
    const timeoutId = window.setTimeout(() => setShowCompletionConfetti(false), 1600);

    return () => window.clearTimeout(timeoutId);
  }, [isLineComplete]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isLineComplete || replaySnapshots.length <= 1) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setReplayIndex((current) => Math.max(0, (current ?? replaySnapshots.length - 1) - 1));
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setReplayIndex((current) => Math.min(replaySnapshots.length - 1, (current ?? replaySnapshots.length - 1) + 1));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLineComplete, replaySnapshots.length]);

  function loadLine(nextCourseId: string, nextLineIndexValue: number) {
    const course = allCourses.find((item) => item.id === nextCourseId) ?? allCourses[0];
    const line = course.lines[nextLineIndexValue] ?? course.lines[0];
    const remote = remoteProgressByLine[`${course.id}:${line.id}`] ?? remoteProgressAllByLine[`${course.id}:${line.id}`];
    const restoredMoveIndex =
      typeof remote?.last_move_index === "number" ? Math.max(0, Math.min(remote.last_move_index, line.moves.length - 1)) : 0;
    const preparedLine = restoredMoveIndex > 0 ? prepareLineAtMove(line, restoredMoveIndex) : applyPrelude(line);

    setActiveCourseId(nextCourseId);
    setLineIndex(nextLineIndexValue);
    setBoardState(preparedLine.boardState);
    setSelectedSquare(null);
    setLegalMoves([]);
    setMoveIndex(restoredMoveIndex);
    setStatus(remote?.status ?? "idle");
    setMoveHistory(preparedLine.moveHistory);
    setPendingPromotion(null);
    setHintedSquare(null);
    setRevealedSquare(null);
    setComputerSquare(null);
    setComputerTargetSquare(null);
    setMistakenSquare(null);
    setCorrectSquare(null);
    setTrainerAnnotations(undefined);
    setReplayIndex(null);
  }

  function openCourseBoard(courseId: string, nextLineIndexValue: number, shouldCountPlay: boolean) {
    loadLine(courseId, nextLineIndexValue);
    setCurrentPage("course");

    if (shouldCountPlay) {
      setPlayEvents(recordCoursePlay(authUser, courseId));
    }
  }

  function handleSelectLesson(courseId: string, nextLineIndexValue: number) {
    const shouldCountPlay = currentPage !== "course" || activeCourseId !== courseId;
    openCourseBoard(courseId, nextLineIndexValue, shouldCountPlay);
  }

  function handleImportCourse(course: OpeningCourse) {
    const preparedLine = applyPrelude(course.lines[0]);
    setImportedCourses((current) => [course, ...current.filter((item) => item.id !== course.id)]);
    setCurrentPage("course");
    setActiveCourseId(course.id);
    setLineIndex(0);
    setBoardState(preparedLine.boardState);
    setSelectedSquare(null);
    setLegalMoves([]);
    setMoveIndex(0);
    setStatus("idle");
    setMoveHistory(preparedLine.moveHistory);
    setPendingPromotion(null);
    setHintedSquare(null);
    setRevealedSquare(null);
    setComputerSquare(null);
    setComputerTargetSquare(null);
    setMistakenSquare(null);
    setCorrectSquare(null);
    setTrainerAnnotations(undefined);
    setReplayIndex(null);
    setPlayEvents(recordCoursePlay(authUser, course.id));
  }

  function handleSelectCourse(courseId: string) {
    const saved = Object.values(remoteProgressAllByLine)
      .filter((entry) => entry.course_id === courseId)
      .sort((left, right) => (right.updated_at ?? "").localeCompare(left.updated_at ?? ""))[0];

    if (saved) {
      handleResumeCourseLine(courseId, saved.line_id);
      return;
    }

    openCourseBoard(courseId, 0, true);
  }

  function handleResumeCourseLine(courseId: string, lineId: string) {
    const course = allCourses.find((item) => item.id === courseId);
    if (!course) {
      openCourseBoard(courseId, 0, true);
      return;
    }

    const nextLineIndex = Math.max(
      0,
      course.lines.findIndex((line) => line.id === lineId)
    );
    openCourseBoard(courseId, nextLineIndex, true);
  }

  function handleResumeActiveLine() {
    loadLine(activeCourseId, lineIndex);
  }

  function handleAuthChange(user: AuthUser | null) {
    setAuthUser(user);
    setAuthPrompt("");
    setMembershipMessage("");
    setMembershipError("");

    if (user) {
      setLocalProfile({
        name: user.name,
        email: user.email
      });
      setCurrentPage("courses");
    } else {
      setCurrentPage("courses");
    }

    setProfileSettingsPanel(null);
  }

  function handleOpenSignup(prefilledEmail?: string) {
    setAuthPrompt("");
    if (prefilledEmail?.trim()) {
      setLocalProfile((current) => ({
        ...current,
        email: prefilledEmail.trim()
      }));
    }

    setAuthEntryMode("signup");
    setCurrentPage("profile");
  }

  function handleOpenLogin() {
    setAuthEntryMode("signin");
    setCurrentPage("profile");
  }

  function promptSignIn(message: string) {
    setAuthPrompt(message);
    handleOpenLogin();
  }

  async function handleMembershipSave() {
    setMembershipError("");
    setMembershipMessage("");

    if (!authUser) {
      setMembershipError("Sign in first to manage membership.");
      return;
    }

    setIsSavingMembership(true);

    try {
      const response = await fetch("/api/auth/membership", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: membershipPlanDraft,
          billingEmail: membershipBillingEmailDraft,
          billingCycle: membershipPlanDraft === "free" ? null : membershipBillingCycleDraft
        })
      });
      const payload = (await response.json()) as { user?: AuthUser; error?: string };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not update membership.");
      }

      handleAuthChange(payload.user);
      setMembershipMessage(`Membership updated to ${payload.user.membershipPlan}.`);
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : "Could not update membership.");
    } finally {
      setIsSavingMembership(false);
    }
  }

  async function handleStripeCheckout() {
    setMembershipError("");
    setMembershipMessage("");

    if (!authUser) {
      setMembershipError("Sign in first to continue to checkout.");
      setCurrentPage("profile");
      return;
    }

    if (membershipPlanDraft === "free") {
      setMembershipError("Pick a paid plan before continuing to checkout.");
      return;
    }

    setIsSavingMembership(true);

    try {
      const response = await fetch("/api/auth/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: membershipPlanDraft,
          billingEmail: membershipBillingEmailDraft,
          billingCycle: membershipBillingCycleDraft
        })
      });
      const payload = (await response.json()) as { checkoutUrl?: string; error?: string };

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || "Could not open Stripe checkout.");
      }

      window.location.href = payload.checkoutUrl;
    } catch (error) {
      setMembershipError(error instanceof Error ? error.message : "Could not open Stripe checkout.");
    } finally {
      setIsSavingMembership(false);
    }
  }

  function handleOpenCourseSuggestion(courseId: string) {
    openCourseBoard(courseId, 0, true);
  }

  function handleOpenWeaknessTarget(patternName: string, color: PieceColor) {
    const targetTokens = tokenizeWeaknessPattern(patternName);
    let bestMatch: { courseId: string; lineIndex: number; score: number } | null = null;

    for (const course of allCourses) {
      for (let nextLineIndexValue = 0; nextLineIndexValue < course.lines.length; nextLineIndexValue += 1) {
        const line = course.lines[nextLineIndexValue];
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

        if (course.source === "manual" || course.source === "community" || course.source === "imported-pgn") {
          score += 5;
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
          bestMatch = { courseId: course.id, lineIndex: nextLineIndexValue, score };
        }
      }
    }

    if (bestMatch && bestMatch.score > 0) {
      openCourseBoard(bestMatch.courseId, bestMatch.lineIndex, true);
      return;
    }

    const fallbackCourse = allCourses.find((course) => course.repertoire === color) ?? allCourses[0];
    openCourseBoard(fallbackCourse.id, 0, true);
  }

  function handleRateCommunityCourse(courseId: string, delta: 1 | -1) {
    setImportedCourses((current) =>
      current.map((course) => {
        if (course.id !== courseId) {
          return course;
        }

        const engagement = course.engagement ?? { likes: 0, rating: 0, votes: 0 };
        const nextVotes = engagement.votes + 1;
        const nextRating = ((engagement.rating * engagement.votes) + delta) / nextVotes;

        return {
          ...course,
          engagement: {
            likes: Math.max(0, engagement.likes + (delta > 0 ? 1 : 0)),
            rating: Number(nextRating.toFixed(2)),
            votes: nextVotes
          }
        };
      })
    );
  }

  async function saveRemoteProgress(update: { courseId: string; lineId: string; status: TrainingStatus; lastMoveIndex: number }) {
    if (!authUser) {
      return;
    }

    setProgressSaveState("saving");
    setProgressSaveError("");
    lastAttemptedProgressSaveRef.current = update;

    const lineProgress = progress.lines[update.lineId];
    const completedReps = lineProgress?.correct ?? 0;
    const mistakeCount = (lineProgress?.revealed ?? 0) + (lineProgress?.lapses ?? 0);

    try {
      const response = await fetch("/api/progress/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: update.courseId,
          line_id: update.lineId,
          status: update.status,
          last_position_fen: null,
          last_move_index: update.lastMoveIndex,
          completed_reps: completedReps,
          mistake_count: mistakeCount
        })
      });

      const payload = (await response.json()) as { progress?: RemoteUserProgress; error?: string };

      if (!response.ok || !payload.progress) {
        setProgressSaveState("error");
        setProgressSaveError(payload.error || "Failed to save progress.");
        return;
      }

      const savedProgress = payload.progress;
      setRemoteProgressByLine((current) => {
        const key = `${savedProgress.course_id}:${savedProgress.line_id}`;
        return { ...current, [key]: savedProgress };
      });
      setProgressSaveState("saved");
      window.setTimeout(() => setProgressSaveState("idle"), 1200);
    } catch {
      setProgressSaveState("error");
      setProgressSaveError("Failed to save progress. Check your connection and retry.");
    }
  }

  function flushRemoteProgressSave() {
    if (progressSaveIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(progressSaveIndicatorTimeoutRef.current);
      progressSaveIndicatorTimeoutRef.current = null;
    }

    if (progressSaveTimeoutRef.current !== null) {
      window.clearTimeout(progressSaveTimeoutRef.current);
      progressSaveTimeoutRef.current = null;
    }

    const pending = pendingProgressSaveRef.current;
    pendingProgressSaveRef.current = null;

    if (!pending) {
      return;
    }

    void saveRemoteProgress(pending);
  }

  function scheduleRemoteProgressSave(update: { courseId: string; lineId: string; status: TrainingStatus; lastMoveIndex: number }) {
    pendingProgressSaveRef.current = update;

    if (progressSaveState !== "error") {
      setProgressSaveError("");
    }

    if (progressSaveIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(progressSaveIndicatorTimeoutRef.current);
    }

    progressSaveIndicatorTimeoutRef.current = window.setTimeout(() => {
      progressSaveIndicatorTimeoutRef.current = null;
      setProgressSaveState((current) => {
        if (!pendingProgressSaveRef.current) {
          return current;
        }
        return current === "idle" || current === "saved" ? "saving" : current;
      });
    }, 450);

    if (progressSaveTimeoutRef.current !== null) {
      window.clearTimeout(progressSaveTimeoutRef.current);
    }

    progressSaveTimeoutRef.current = window.setTimeout(() => {
      progressSaveTimeoutRef.current = null;
      flushRemoteProgressSave();
    }, 800);
  }

  useEffect(() => {
    return () => {
      flushRemoteProgressSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRetryProgressSave() {
    const lastAttempted = lastAttemptedProgressSaveRef.current;
    if (!lastAttempted) {
      return;
    }

    flushRemoteProgressSave();
    void saveRemoteProgress(lastAttempted);
  }

  function handleSquareClick(square: Square) {
    if (!authUser) {
      promptSignIn("Sign in to train and save your progress.");
      return;
    }

    if (status === "correct") {
      return;
    }

    if (computerSquare || computerTargetSquare) {
      setComputerSquare(null);
      setComputerTargetSquare(null);
    }

    if (selectedSquare && legalMoves.some((move) => sameSquare(move, square))) {
      const movingPiece = getPiece(boardState.board, selectedSquare);

      if (movingPiece?.type === "pawn" && (square.rank === 0 || square.rank === 7)) {
        setPendingPromotion({ from: selectedSquare, to: square });
        return;
      }

      const result = makeMove(boardState.board, selectedSquare, square, { castlingRights: boardState.castlingRights, enPassantTarget: boardState.enPassantTarget });

      if (!result) {
        return;
      }

      const uci = moveToUci(selectedSquare, square);
      handleMove(result.move, result.board, uci);
      return;
    }

    const moves = getSelectableMoves(boardState.board, square, boardState.turn, boardState.castlingRights, boardState.enPassantTarget);

    setSelectedSquare(moves.length ? square : null);
    setLegalMoves(moves);
  }

  function handlePromotionChoice(promotion: PieceType) {
    if (!pendingPromotion) {
      return;
    }

    const result = makeMove(boardState.board, pendingPromotion.from, pendingPromotion.to, {
      promotion,
      castlingRights: boardState.castlingRights,
      enPassantTarget: boardState.enPassantTarget
    });

    if (!result) {
      setPendingPromotion(null);
      return;
    }

    handleMove(result.move, result.board, moveToUci(pendingPromotion.from, pendingPromotion.to, promotion));
    setPendingPromotion(null);
  }

  function handleMove(move: ChessMove, nextBoard: Board, uci: string) {
    const wasCorrect = isExpectedMove(activeLine, moveIndex, uci);

    if (!wasCorrect) {
      const previousBoardState = boardState;
      setSelectedSquare(null);
      setLegalMoves([]);
      setBoardState({
        board: nextBoard,
        turn: boardState.turn === "white" ? "black" : "white",
        castlingRights: getUpdatedCastlingRights(boardState.board, move.from, move.to, boardState.castlingRights),
        enPassantTarget: getNextEnPassantTarget(boardState.board, move.from, move.to)
      });
      setHintedSquare(null);
      setRevealedSquare(null);
      setComputerSquare(null);
      setComputerTargetSquare(null);
      setMistakenSquare(move.to);
      setCorrectSquare(null);
      setTrainerAnnotations(undefined);
      setStatus("incorrect");
      setProgress((current) => updateProgressForAnswer(current, activeLine.id, false));
      playTrainerSound("wrong", soundEnabled);
      window.setTimeout(() => {
        setBoardState(previousBoardState);
        setMistakenSquare(null);
      }, 850);
      return;
    }

    const appliedLine = applyOpponentReply(nextBoard, boardState.turn === "white" ? "black" : "white");
    const currentUci = parseUciMove(currentMove.uci);
    const nextTurn = boardState.turn === "white" ? "black" : "white";
    const nextCastlingRights = getUpdatedCastlingRights(boardState.board, currentUci.from, currentUci.to, boardState.castlingRights);
    const nextEnPassantTarget = getNextEnPassantTarget(boardState.board, currentUci.from, currentUci.to);

    setBoardState(
      currentMove.opponentReply
        ? {
            board: nextBoard,
            turn: nextTurn,
            castlingRights: nextCastlingRights,
            enPassantTarget: nextEnPassantTarget
          }
        : {
            board: appliedLine.board,
            turn: appliedLine.turn,
            castlingRights: appliedLine.castlingRights,
            enPassantTarget: appliedLine.enPassantTarget
          }
    );
    setSelectedSquare(null);
    setLegalMoves([]);
    setHintedSquare(null);
    setRevealedSquare(null);
    setComputerSquare(currentMove.opponentReply ? parseUciMove(currentMove.opponentReply.uci).from : null);
    setComputerTargetSquare(currentMove.opponentReply ? parseUciMove(currentMove.opponentReply.uci).to : null);
    setMistakenSquare(null);
    setCorrectSquare(move.to);
    setTrainerAnnotations(undefined);
    setMoveHistory((history) => [...history, move.notation]);
    setStatus("correct");
    setProgress((current) => updateProgressForAnswer(current, activeLine.id, true, moveIndex === activeLine.moves.length - 1));
    playTrainerSound(moveIndex === activeLine.moves.length - 1 ? "complete" : move.captured ? "capture" : "move", soundEnabled);

    if (moveIndex === activeLine.moves.length - 1) {
      flushRemoteProgressSave();
      void saveRemoteProgress({ courseId: activeCourse.id, lineId: activeLine.id, status: "correct", lastMoveIndex: moveIndex });
    }

    if (currentMove.opponentReply) {
      window.setTimeout(() => {
        setBoardState({
          board: appliedLine.board,
          turn: appliedLine.turn,
          castlingRights: appliedLine.castlingRights,
          enPassantTarget: appliedLine.enPassantTarget
        });
        setMoveHistory((history) => [...history, ...appliedLine.notation]);
        playTrainerSound(appliedLine.captured ? "capture" : "move", soundEnabled);
      }, 450);
    }

    if (wasCorrect && moveIndex < activeLine.moves.length - 1) {
      window.setTimeout(() => {
        setMoveIndex((index) => index + 1);
        setStatus("idle");
        setHintedSquare(null);
        setRevealedSquare(null);
        setComputerSquare(null);
        setComputerTargetSquare(null);
        setMistakenSquare(null);
        setCorrectSquare(null);
        setTrainerAnnotations(undefined);
        scheduleRemoteProgressSave({ courseId: activeCourse.id, lineId: activeLine.id, status: "idle", lastMoveIndex: moveIndex + 1 });
      }, currentMove.opponentReply ? 950 : 650);
    }
  }

  function handleHint() {
    if (!authUser) {
      promptSignIn("Sign in to train and save your progress.");
      return;
    }

    const { from } = parseUciMove(currentMove.uci);
    setHintedSquare(from);
    setRevealedSquare(null);
    setMistakenSquare(null);
    setCorrectSquare(null);
  }

  function handleReveal() {
    if (!authUser) {
      promptSignIn("Sign in to train and save your progress.");
      return;
    }

    const { from, to, promotion } = parseUciMove(currentMove.uci);
    const result = makeMove(boardState.board, from, to, { promotion, castlingRights: boardState.castlingRights, enPassantTarget: boardState.enPassantTarget });

    if (!result) {
      return;
    }

    const appliedLine = applyOpponentReply(result.board, boardState.turn === "white" ? "black" : "white");
    setSelectedSquare(null);
    setLegalMoves([]);
    setHintedSquare(null);
    setRevealedSquare(to);
    setComputerSquare(currentMove.opponentReply ? parseUciMove(currentMove.opponentReply.uci).from : null);
    setComputerTargetSquare(currentMove.opponentReply ? parseUciMove(currentMove.opponentReply.uci).to : null);
    setMistakenSquare(null);
    setCorrectSquare(null);
    setTrainerAnnotations({
      arrows: [{ from: squareToNotation(from), to: squareToNotation(to), color: "yellow" }]
    });
    setMoveHistory((history) => [...history, result.move.notation]);
    setStatus("correct");
    setProgress((current) => updateProgressForReveal(current, activeLine.id));
    playTrainerSound(moveIndex === activeLine.moves.length - 1 ? "complete" : result.move.captured ? "capture" : "move", soundEnabled);

    if (moveIndex === activeLine.moves.length - 1) {
      flushRemoteProgressSave();
      void saveRemoteProgress({ courseId: activeCourse.id, lineId: activeLine.id, status: "correct", lastMoveIndex: moveIndex });
    }

    if (currentMove.opponentReply) {
      const currentUci = parseUciMove(currentMove.uci);
      const nextTurn = boardState.turn === "white" ? "black" : "white";
      const nextCastlingRights = getUpdatedCastlingRights(boardState.board, currentUci.from, currentUci.to, boardState.castlingRights);
      const nextEnPassantTarget = getNextEnPassantTarget(boardState.board, currentUci.from, currentUci.to);
      setBoardState({
        board: result.board,
        turn: nextTurn,
        castlingRights: nextCastlingRights,
        enPassantTarget: nextEnPassantTarget
      });
      window.setTimeout(() => {
        setBoardState({
          board: appliedLine.board,
          turn: appliedLine.turn,
          castlingRights: appliedLine.castlingRights,
          enPassantTarget: appliedLine.enPassantTarget
        });
        setMoveHistory((history) => [...history, ...appliedLine.notation]);
        playTrainerSound(appliedLine.captured ? "capture" : "move", soundEnabled);
      }, 450);
    } else {
      setBoardState({
        board: appliedLine.board,
        turn: appliedLine.turn,
        castlingRights: appliedLine.castlingRights,
        enPassantTarget: appliedLine.enPassantTarget
      });
    }

    if (moveIndex < activeLine.moves.length - 1) {
      window.setTimeout(() => {
        setMoveIndex((index) => index + 1);
        setStatus("idle");
        setHintedSquare(null);
        setRevealedSquare(null);
        setComputerSquare(null);
        setComputerTargetSquare(null);
        setMistakenSquare(null);
        setCorrectSquare(null);
        setTrainerAnnotations(undefined);
        scheduleRemoteProgressSave({ courseId: activeCourse.id, lineId: activeLine.id, status: "idle", lastMoveIndex: moveIndex + 1 });
      }, currentMove.opponentReply ? 1200 : 900);
    }
  }

  function handleReset() {
    loadLine(activeCourse.id, lineIndex);
  }

  function handleUndoMove() {
    if (status !== "idle" || moveIndex <= 0) {
      return;
    }

    const previousMoveIndex = Math.max(0, moveIndex - 1);
    const prepared = prepareLineAtMove(activeLine, previousMoveIndex);

    setBoardState(prepared.boardState);
    setSelectedSquare(null);
    setLegalMoves([]);
    setMoveIndex(previousMoveIndex);
    setStatus("idle");
    setMoveHistory(prepared.moveHistory);
    setPendingPromotion(null);
    setHintedSquare(null);
    setRevealedSquare(null);
    setComputerSquare(null);
    setComputerTargetSquare(null);
    setMistakenSquare(null);
    setCorrectSquare(null);
    setTrainerAnnotations(undefined);
    setReplayIndex(null);
  }

  function handleNextLine() {
    loadLine(activeCourse.id, nextLineIndex(lineIndex, activeCourse.lines.length));
  }

  function handlePreviousLine() {
    loadLine(activeCourse.id, previousLineIndex(lineIndex, activeCourse.lines.length));
  }

  function handleNextDueLine() {
    const dueLines = getDueLines(activeCourse, progress);
    const currentDueIndex = dueLines.findIndex((line) => line.id === activeLine.id);
    const nextDueLine = dueLines[currentDueIndex + 1] ?? dueLines[0];

    if (!nextDueLine) {
      handleNextLine();
      return;
    }

    const nextIndex = activeCourse.lines.findIndex((line) => line.id === nextDueLine.id);
    loadLine(activeCourse.id, Math.max(0, nextIndex));
  }

  function handleNextMistakeLine() {
    const mistakeLines = getMistakeReviewLines(activeCourse, progress);
    const currentMistakeIndex = mistakeLines.findIndex((line) => line.id === activeLine.id);
    const nextMistakeLine = mistakeLines[currentMistakeIndex + 1] ?? mistakeLines[0];

    if (!nextMistakeLine) {
      handleNextLine();
      return;
    }

    const nextIndex = activeCourse.lines.findIndex((line) => line.id === nextMistakeLine.id);
    loadLine(activeCourse.id, Math.max(0, nextIndex));
  }

  function handleGradeReview(grade: ReviewGrade) {
    setProgress((current) => rescheduleLineForGrade(current, activeLine.id, grade));
  }

  function handleReplayPrevious() {
    if (!isLineComplete) {
      return;
    }

    setReplayIndex((current) => Math.max(0, (current ?? replaySnapshots.length - 1) - 1));
  }

  function handleReplayNext() {
    if (!isLineComplete) {
      return;
    }

    setReplayIndex((current) => Math.min(replaySnapshots.length - 1, (current ?? replaySnapshots.length - 1) + 1));
  }

  function applyOpponentReply(board: Board, turn: PieceColor): {
    board: Board;
    turn: PieceColor;
    castlingRights: CastlingRights;
    enPassantTarget: Square | null;
    notation: string[];
    captured: boolean;
  } {
    const currentUci = parseUciMove(currentMove.uci);
    const nextCastlingRights = getUpdatedCastlingRights(boardState.board, currentUci.from, currentUci.to, boardState.castlingRights);
    const nextEnPassantTarget = getNextEnPassantTarget(boardState.board, currentUci.from, currentUci.to);

    if (!currentMove.opponentReply) {
      return { board, turn, castlingRights: nextCastlingRights, enPassantTarget: nextEnPassantTarget, notation: [], captured: false };
    }

    const { from, to, promotion } = parseUciMove(currentMove.opponentReply.uci);
    const reply = makeMove(board, from, to, { promotion, castlingRights: nextCastlingRights, enPassantTarget: nextEnPassantTarget });

    if (!reply) {
      return { board, turn, castlingRights: nextCastlingRights, enPassantTarget: nextEnPassantTarget, notation: [], captured: false };
    }

    return {
      board: reply.board,
      turn: turn === "white" ? "black" : "white",
      castlingRights: getUpdatedCastlingRights(board, from, to, nextCastlingRights),
      enPassantTarget: getNextEnPassantTarget(board, from, to),
      notation: [currentMove.opponentReply.san],
      captured: Boolean(reply.move.captured)
    };
  }

  const dueLines = getDueLines(activeCourse, progress);
  const mistakeLines = getMistakeReviewLines(activeCourse, progress);
  const dueCount = dueLines.length;
  const mistakeCount = mistakeLines.length;
  const weakSpots = mistakeLines.slice(0, 3);
  const recentActivity = getRecentActivity(progress);
  const maxActivityAttempts = Math.max(1, ...recentActivity.map((day) => day.attempts));
  const reviewedInCourse = reviewedLineCount(activeCourse, progress);
  const masteredInCourse = getCourseLines(activeCourse).filter((line) => getLineStatus(line, progress) === "mastered").length;
  const shakyInCourse = getCourseLines(activeCourse).filter((line) => getLineStatus(line, progress) === "shaky").length;
  const activeLineProgress = progress.lines[activeLine.id];
  const streak = progress.streak ?? initialProgress.streak;
  const createdCourseCount = importedCourses.filter((course) => course.source === "manual" || course.source === "imported-pgn").length;
  const sharedCourseCount = importedCourses.filter((course) => course.isShared).length;
  const totalLessons = allCourses.reduce((sum, course) => sum + getCourseLines(course).length, 0);
  const totalFavorites = Object.keys(loadFavoriteLinesSnapshot()).length;
  const totalReviewedLines = allCourses.reduce((sum, course) => sum + reviewedLineCount(course, progress), 0);
  const profileName = authUser?.name || localProfile.name;
  const profileEmail = authUser?.email || localProfile.email;
  const profileInitials = getProfileInitials(profileName);
  const achievements = [
    {
      id: "streak",
      title: "Daily streak",
      description: streak.best >= 7 ? `Best run: ${streak.best} days in a row.` : "Show up on multiple days to build momentum.",
      progressLabel: `${Math.min(streak.best, 7)}/7`,
      progress: Math.min(100, Math.round((Math.min(streak.best, 7) / 7) * 100))
    },
    {
      id: "reviewed",
      title: "Lines reviewed",
      description:
        totalReviewedLines >= 25
          ? `${totalReviewedLines} lines have been touched in your library.`
          : "Touch 25 lines to unlock your first deep-study milestone.",
      progressLabel: `${Math.min(totalReviewedLines, 25)}/25`,
      progress: Math.min(100, Math.round((Math.min(totalReviewedLines, 25) / 25) * 100))
    },
    {
      id: "creator",
      title: "Course creator",
      description:
        createdCourseCount >= 1
          ? `${createdCourseCount} created course${createdCourseCount === 1 ? "" : "s"}, ${sharedCourseCount} shared with the community.`
          : "Build your first course to start your creator journey.",
      progressLabel: `${Math.min(createdCourseCount, 3)}/3`,
      progress: Math.min(100, Math.round((Math.min(createdCourseCount, 3) / 3) * 100))
    },
    {
      id: "bookmarks",
      title: "Quick-review kit",
      description:
        totalFavorites >= 5
          ? `${totalFavorites} lines are pinned for quick return visits.`
          : "Bookmark 5 lines you want to revisit often.",
      progressLabel: `${Math.min(totalFavorites, 5)}/5`,
      progress: Math.min(100, Math.round((Math.min(totalFavorites, 5) / 5) * 100))
    }
  ];
  const activeBoardTheme = boardThemes.find((theme) => theme.id === boardThemeId) ?? boardThemes[0];
  const gameStatus = getGameStatus(displayedBoardState.board, displayedBoardState.turn, displayedBoardState.castlingRights, displayedBoardState.enPassantTarget);
  const reviewLabel = activeLineProgress
    ? activeLineProgress.dueAt && new Date(activeLineProgress.dueAt).getTime() <= Date.now()
      ? "due review"
      : `${activeLineProgress.streak} correct streak`
    : `${activeLine.dueLevel} line`;
  const featuredCourse = useMemo(() => allCourses.find((course) => course.repertoire === "white") ?? allCourses[0], [allCourses]);
const topNavigationItems: Array<{ page: HomeView; label: string; isActive: boolean }> = [
    { page: "landing", label: "Start Free Trial", isActive: currentPage === "landing" },
    { page: "courses", label: "Courses", isActive: currentPage === "courses" || currentPage === "course" },
    { page: "analysis", label: "Analysis", isActive: currentPage === "analysis" },
    { page: "create", label: "Create a course", isActive: currentPage === "create" },
    { page: "community", label: "Community", isActive: currentPage === "community" },
    { page: "leaderboard", label: "Leaderboards", isActive: currentPage === "leaderboard" },
    { page: "affiliates", label: "Affiliates", isActive: currentPage === "affiliates" }
  ];
  const showTopNavigation = currentPage !== "course" && currentPage !== "analysis";

  return (
    <>
      {currentPage === "course" || currentPage === "analysis" ? (
        <AppSidebar
          page={currentPage}
          onPageChange={setCurrentPage}
          isCompactCourseSidebar={isCompactCourseSidebar}
          onToggleCompactCourseSidebar={() => setIsCompactCourseSidebar((current) => !current)}
          isCompactAnalysisSidebar={isCompactAnalysisSidebar}
          onToggleCompactAnalysisSidebar={() => setIsCompactAnalysisSidebar((current) => !current)}
          courses={allCourses}
          activeCourseId={activeCourse.id}
          activeLineId={activeLine.id}
          progress={progress}
          onSelectLesson={handleSelectLesson}
          analysisSections={analysisSections}
          activeAnalysisSection={activeAnalysisSection}
          onSelectAnalysisSection={setActiveAnalysisSection}
        />
      ) : null}
      <main
        className={[
          "min-h-screen px-4 py-5 sm:px-6",
          currentPage === "course"
            ? isCompactCourseSidebar
              ? "lg:pl-[156px] lg:pr-8"
              : "lg:pl-[384px] lg:pr-8"
            : currentPage === "analysis"
              ? isCompactAnalysisSidebar
                ? "lg:pl-[156px] lg:pr-8"
                : "lg:pl-[384px] lg:pr-8"
              : "lg:px-8"
        ].join(" ")}
      >
        <div className="mx-auto max-w-7xl space-y-5">
          <div
            className={[
              "grid gap-3 lg:items-start",
              showTopNavigation ? "lg:grid-cols-[250px_minmax(0,1fr)_auto]" : "lg:grid-cols-[1fr_auto]"
            ].join(" ")}
          >
            {!showTopNavigation ? (
              <div className="hidden lg:block" />
            ) : (
              <button
                type="button"
                onClick={() => setCurrentPage("courses")}
                className="flex items-center gap-3 justify-self-start rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.05]"
              >
                <img
                  src="/blounderproof-logo.png"
                  alt="Blounderproof logo"
                  className="h-16 w-16 rounded-lg object-cover shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">BLUNDERPROOF</p>
                  <p className="mt-1 text-xs text-zinc-400">Openings, endgames, analysis, and community</p>
                </div>
              </button>
            )}

            {showTopNavigation ? (
              <div className="flex flex-wrap items-center justify-center gap-2 lg:px-6">
                {topNavigationItems.map((item) => (
                  <button
                    key={item.page}
                    type="button"
                    onClick={() => setCurrentPage(item.page)}
                    className={[
                      "rounded-md border px-4 py-2 text-sm font-semibold transition",
                      item.isActive
                        ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                    ].join(" ")}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="ml-auto flex items-start gap-3 justify-self-end">
              <button
                type="button"
                onClick={() => setCurrentPage("leaderboard")}
                aria-label="Open leaderboards"
                className={[
                  "grid h-[86px] w-[92px] place-items-center rounded-lg border transition",
                  currentPage === "leaderboard"
                    ? "border-amber-300/30 bg-amber-300/12 text-amber-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                ].join(" ")}
              >
                <div className="text-center">
                  <div className="relative mx-auto grid h-11 w-11 place-items-center rounded-full border border-current/15 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
                      <path d="M8 5h8" strokeLinecap="round" />
                      <path d="M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" strokeLinecap="round" />
                      <path d="M7 5h10v2a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V5Z" />
                      <path d="M17 6h2a1 1 0 0 1 1 1c0 2.2-1.8 4-4 4" strokeLinecap="round" />
                      <path d="M7 6H5a1 1 0 0 0-1 1c0 2.2 1.8 4 4 4" strokeLinecap="round" />
                      <path d="M12 11v4" strokeLinecap="round" />
                      <path d="M9 19h6" strokeLinecap="round" />
                      <path d="M10 15h4l1 4H9l1-4Z" />
                    </svg>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em]">Leaders</p>
                </div>
              </button>
              <button
                type="button"
                onClick={handleOpenLogin}
                aria-label="Open profile"
                className={[
                  "grid h-[86px] w-[92px] place-items-center rounded-lg border transition",
                  currentPage === "profile"
                    ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                ].join(" ")}
              >
                <div className="text-center">
                  <div className="relative mx-auto grid h-11 w-11 place-items-center rounded-full border border-current/15 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    {authUser ? (
                      <span className="text-sm font-semibold uppercase tracking-[0.12em]">{profileInitials}</span>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
                        <path d="M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
                        <path d="M5.5 19.25a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
                      </svg>
                    )}
                    <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-zinc-950 bg-emerald-300" />
                  </div>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em]">Profile</p>
                </div>
              </button>
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-right shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Daily streak</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {streak.current} day{streak.current === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Best: {streak.best} day{streak.best === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>

          {currentPage === "landing" ? (
            <LandingPage
              featuredCourse={featuredCourse}
              onStartFreeTrial={() => handleOpenSignup()}
              onViewCourses={() => setCurrentPage("courses")}
              onLogin={handleOpenLogin}
            />
          ) : currentPage === "courses" ? (
            <>
              <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Courses page</p>
                    <h1 className="mt-2 text-2xl font-semibold text-white">Choose a course and jump into training</h1>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Search here on the main page, then click a course to open the dedicated board page with all its lines in the left sidebar.
                    </p>
                  </div>
                  <div className="w-full max-w-md">
                    <label htmlFor="course-catalog-search" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Search courses
                    </label>
                    <div className="mt-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
                      <input
                        id="course-catalog-search"
                        type="text"
                        value={courseSearchQuery}
                        onChange={(event) => setCourseSearchQuery(event.target.value)}
                        placeholder="Jobava, Caro, endgames..."
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {lastProgressEntry ? (
                <section className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="max-w-3xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Resume where you left off</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-200">
                        Continue your latest training session in{" "}
                        <span className="font-semibold text-white">
                          {(allCourses.find((course) => course.id === lastProgressEntry.course_id)?.name ?? "a course")}
                        </span>
                        .
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResumeCourseLine(lastProgressEntry.course_id, lastProgressEntry.line_id)}
                      className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
                    >
                      Continue
                    </button>
                  </div>
                </section>
              ) : null}

              <CourseCatalog
                courses={filteredCourses}
                activeCourseId={activeCourse.id}
                progress={progress}
                onSelectCourse={handleSelectCourse}
                remoteProgress={remoteProgressAllByLine}
                onResume={handleResumeCourseLine}
              />
              <CommunityCourseShelf courses={communityCourses} onOpenCourse={handleSelectCourse} />

            </>
          ) : currentPage === "course" ? (
            <>
              <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Course board</p>
                    <h1 className="mt-2 text-2xl font-semibold text-white">{activeCourse.name}</h1>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{activeCourse.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded-full border border-white/10 px-2 py-1">{activeCourse.lines.length} lessons</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">{activeCourse.repertoire} repertoire</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">{activeCourse.level}</span>
                  </div>
                </div>
              </section>

              {(() => {
                const saved = remoteProgressByLine[`${activeCourseId}:${activeLine.id}`];
                const savedMoveIndex = typeof saved?.last_move_index === "number" ? saved.last_move_index : 0;
                const shouldOfferResume = savedMoveIndex > 0 && moveIndex < savedMoveIndex;

                if (!shouldOfferResume) {
                  return null;
                }

                return (
                  <section className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-[240px]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Saved progress found</p>
                        <p className="mt-1 text-sm text-zinc-200">
                          Resume at move {savedMoveIndex + 1} for this line.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResumeActiveLine}
                        className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200"
                      >
                        Resume
                      </button>
                    </div>
                  </section>
                );
              })()}

              <section className="grid gap-5 lg:grid-cols-[minmax(420px,1fr)_360px] xl:grid-cols-[minmax(420px,1fr)_390px]">
                <div className="rounded-lg border border-white/10 bg-zinc-950/50 p-3 sm:p-5">
                  <div className="relative">
                    {showCompletionConfetti ? <CompletionConfetti key={completionConfettiKey} /> : null}
                  <Chessboard
                    board={displayedBoardState.board}
                    turn={displayedBoardState.turn}
                    orientation={activeLine.sideToTrain}
                    theme={activeBoardTheme}
                    annotations={mergeBoardAnnotations(currentMove.annotations, trainerAnnotations)}
                    hintedSquare={hintedSquare}
                    revealedSquare={revealedSquare}
                    computerSquare={computerSquare}
                    computerTargetSquare={computerTargetSquare}
                    mistakenSquare={mistakenSquare}
                    correctSquare={correctSquare}
                    selectedSquare={selectedSquare}
                    legalMoves={legalMoves}
                    gameStatus={gameStatus}
                    onSquareClick={handleSquareClick}
                  />
                  </div>
                  {pendingPromotion ? (
                    <div className="mt-4 rounded-lg border border-white/10 bg-black/25 p-3">
                      <p className="text-sm font-medium text-zinc-200">Choose promotion</p>
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {(["queen", "rook", "bishop", "knight"] as PieceType[]).map((piece) => (
                          <button
                            key={piece}
                            type="button"
                            onClick={() => handlePromotionChoice(piece)}
                            className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold capitalize text-zinc-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
                          >
                            {piece}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <TrainerPanel
                    line={activeLine}
                    move={currentMove}
                    moveIndex={moveIndex}
                    status={status}
                    lineStatus={activeLineStatus}
                    reviewLabel={reviewLabel}
                    moveHistory={moveHistory}
                    trainingMode={trainingMode}
                    soundEnabled={soundEnabled}
                    dueLineCount={dueLinesForCourse.length}
                    mistakeLineCount={mistakeLinesForCourse.length}
                    reviewedLineCount={reviewedInCourse}
                    totalLineCount={getCourseLines(activeCourse).length}
                    masteredLineCount={masteredInCourse}
                    shakyLineCount={shakyInCourse}
                    canUndoMove={canUndoMove}
                    canGoPreviousLine={canGoPreviousLine}
                    onToggleSound={() => setSoundEnabled((current) => !current)}
                    onTrainingModeChange={setTrainingMode}
                    replayIndex={replayIndex}
                    replayCount={replaySnapshots.length}
                    onReplayPrevious={handleReplayPrevious}
                    onReplayNext={handleReplayNext}
                    onHint={handleHint}
                    onReveal={handleReveal}
                    onUndoMove={handleUndoMove}
                    onReset={handleReset}
                    onPreviousLine={handlePreviousLine}
                    onNextLine={handleNextLine}
                    onNextDueLine={handleNextDueLine}
                    onNextMistakeLine={handleNextMistakeLine}
                    onGradeReview={handleGradeReview}
                  />
                  {authUser ? (
                    <div className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                      {progressSaveState === "saving" ? (
                        <span>Saving...</span>
                      ) : progressSaveState === "saved" ? (
                        <span className="text-emerald-200">Saved</span>
                      ) : progressSaveState === "error" ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-rose-200">{progressSaveError || "Failed to save progress."}</span>
                          <button
                            type="button"
                            onClick={handleRetryProgressSave}
                            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <span className="text-zinc-500">Progress sync ready</span>
                      )}
                    </div>
                  ) : null}
                  <CourseLeaderboardCard
                    course={activeCourse}
                    playEvents={playEvents}
                    range={courseLeaderboardRange}
                    onRangeChange={setCourseLeaderboardRange}
                  />
                </div>
              </section>
            </>
          ) : currentPage === "create" ? (
            <>
              <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Create a course</p>
                    <h1 className="mt-2 text-2xl font-semibold text-white">Build a course from PGN</h1>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Create lines by hand on the board or import them from PGN, then save the course and jump straight into training.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded-full border border-white/10 px-2 py-1">Manual builder</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">Preview before import</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">Community-ready metadata</span>
                  </div>
                </div>
              </section>

              <ManualCourseBuilder onSaveCourse={handleImportCourse} soundEnabled={soundEnabled} />
              <PgnImporter onImportCourse={handleImportCourse} />
            </>
          ) : currentPage === "community" ? (
            <CommunityPage courses={communityCourses} onOpenCourse={handleSelectCourse} onRateCourse={handleRateCommunityCourse} />
          ) : currentPage === "leaderboard" ? (
            <LeaderboardPage
              courses={allCourses}
              playEvents={playEvents}
              range={leaderboardRange}
              onRangeChange={setLeaderboardRange}
              onOpenCourse={handleSelectCourse}
            />
          ) : currentPage === "affiliates" ? (
            <AffiliateAdminPage currentUser={authUser} />
          ) : currentPage === "profile" ? (
            <>
              <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Profile</p>
                    <h1 className="mt-2 text-2xl font-semibold text-white">
                      {authUser
                        ? "Your Blounderproof profile"
                        : authEntryMode === "signup"
                          ? "Start your BlunderProof free trial"
                          : "Welcome back to BlunderProof"}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {authUser
                        ? "A simple home for your training habits, course progress, and the courses you have created so far."
                        : authEntryMode === "signup"
                          ? "Create your account, start the 7-day trial, and then we can move you straight into courses, analysis, and interactive practice."
                          : "Sign in to pick up your training progress, review queue, and saved courses right where you left them."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-14 w-14 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 text-2xl text-emerald-100">
                        {profileInitials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{profileName || "Blounderproof player"}</p>
                        <p className="mt-1 text-xs text-zinc-500">{profileEmail || "Training locally on this device"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {!authUser && authEntryMode === "signup" ? (
                <section className="grid gap-3 sm:grid-cols-3">
                  <StatCard label="Free trial" value="7 days" detail="Train with the full product before billing is wired." />
                  <StatCard label="Getting started" value="Under 1 min" detail="Create the account and jump into the app flow quickly." />
                  <StatCard label="No card needed" value="For now" detail="Stripe trial activation will connect here later." />
                </section>
              ) : null}

              {!authUser && authPrompt ? (
                <section className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-zinc-200">
                  {authPrompt}
                </section>
              ) : null}

              {!authUser ? (
                <ProfileAccountSection
                  currentUser={authUser}
                  initialName={localProfile.name}
                  initialEmail={localProfile.email}
                  referralAttribution={referralAttribution}
                  preferredMode={authEntryMode}
                  onAuthChange={handleAuthChange}
                />
              ) : null}

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Courses in library" value={allCourses.length.toString()} detail={`${totalLessons} lessons across your study library`} />
                <StatCard label="Active course" value={activeCourse.lines.length.toString()} detail={activeCourse.name} />
                <StatCard label="Created courses" value={createdCourseCount.toString()} detail={`${sharedCourseCount} shared with the community`} />
                <StatCard label="Bookmarked lines" value={totalFavorites.toString()} detail="Saved for quick review later" />
              </section>

              <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Activity history</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Last 7 days</h2>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-white/10 px-2 py-1">{recentActivity.reduce((sum, day) => sum + day.attempts, 0)} attempts</span>
                        <span className="rounded-full border border-white/10 px-2 py-1">{recentActivity.reduce((sum, day) => sum + day.completedLines, 0)} lines completed</span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-7 gap-2">
                      {recentActivity.map((day) => {
                        const barHeight = Math.max(10, Math.round((day.attempts / maxActivityAttempts) * 84));
                        const dayLabel = new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });

                        return (
                          <div key={day.date} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-3">
                            <div className="flex h-24 items-end justify-center">
                              <div
                                className="w-full rounded-md bg-sky-300/80 transition-all"
                                style={{ height: `${barHeight}px` }}
                                title={`${day.attempts} attempts, ${day.completedLines} lines completed, ${day.revealed} reveals`}
                              />
                            </div>
                            <div className="mt-3 text-center">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{dayLabel}</p>
                              <p className="mt-1 text-sm font-semibold text-white">{day.attempts}</p>
                              <p className="text-[10px] text-zinc-500">{day.completedLines} done</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Board theme</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Preview your board</h2>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">{activeBoardTheme.name}</span>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <ProfileBoardPreview board={profilePreviewBoard} theme={activeBoardTheme} />
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Board colors</p>
                            <p className="mt-1 text-xs leading-5 text-zinc-500">Pick the look you want to train with across the app later.</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {boardThemes.map((theme) => (
                            <button
                              key={theme.id}
                              type="button"
                              onClick={() => setBoardThemeId(theme.id)}
                              className={[
                                "rounded-lg border p-3 text-left transition",
                                boardThemeId === theme.id
                                  ? "border-emerald-300/35 bg-emerald-300/10"
                                  : "border-white/10 bg-black/20 hover:bg-white/[0.03]"
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold text-white">{theme.name}</span>
                                <span className="flex items-center gap-1">
                                  <span className="h-4 w-4 rounded-full border border-black/20" style={{ backgroundColor: theme.light }} />
                                  <span className="h-4 w-4 rounded-full border border-white/10" style={{ backgroundColor: theme.dark }} />
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-4">
                  <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Profile summary</p>
                    <div className="mt-4 space-y-3 text-sm text-zinc-300">
                      <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                        <span>Accuracy</span>
                        <span className="font-semibold text-white">{accuracy(progress)}%</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                        <span>Review queue</span>
                        <span className="font-semibold text-white">{dueCount}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                        <span>Mistake review</span>
                        <span className="font-semibold text-white">{mistakeCount}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
                        <span>Best streak</span>
                        <span className="font-semibold text-white">{streak.best} day{streak.best === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Achievements</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Progress worth keeping</h2>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">
                        {achievements.filter((achievement) => achievement.progress >= 100).length}/{achievements.length} complete
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {achievements.map((achievement) => (
                        <div key={achievement.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white">{achievement.title}</p>
                              <p className="mt-1 text-xs leading-5 text-zinc-500">{achievement.description}</p>
                            </div>
                            <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">
                              {achievement.progressLabel}
                            </span>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-white/[0.06]">
                            <div
                              className="h-2 rounded-full bg-amber-300 transition-all"
                              style={{ width: `${achievement.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">Current focus</p>
                    <h2 className="mt-2 text-lg font-semibold text-white">{activeCourse.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{activeCourse.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                      <span className="rounded-full border border-white/10 px-2 py-1">{activeCourse.lines.length} lessons</span>
                      <span className="rounded-full border border-white/10 px-2 py-1">{activeCourse.repertoire}</span>
                      <span className="rounded-full border border-white/10 px-2 py-1">{activeCourse.level}</span>
                    </div>
                  </section>

                  {authUser ? (
                    <ProfileAccountSection
                      currentUser={authUser}
                      initialName={localProfile.name}
                      initialEmail={localProfile.email}
                      referralAttribution={referralAttribution}
                      preferredMode={authEntryMode}
                      onAuthChange={handleAuthChange}
                    />
                  ) : null}

                  <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">More settings</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Membership and app options</h2>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-400">
                        {authUser ? "Signed in" : "Local mode"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">Manage membership</p>
                              <p className="mt-1 text-xs leading-5 text-zinc-500">Pick a plan, keep a billing email on file, and save it to your account.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setProfileSettingsPanel((current) => (current === "membership" ? null : "membership"))
                              }
                              className={[
                                "rounded-md border px-3 py-2 text-xs font-semibold transition",
                                profileSettingsPanel === "membership"
                                  ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                                  : "border-white/10 text-zinc-300 hover:bg-white/[0.05]"
                              ].join(" ")}
                            >
                              {profileSettingsPanel === "membership" ? "Hide" : "Open"}
                            </button>
                          </div>
                          {profileSettingsPanel === "membership" ? (
                            <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                                  <p className="text-sm font-semibold text-white">Current plan</p>
                                  <p className="mt-1 text-xs capitalize text-zinc-500">{authUser?.membershipPlan ?? "free"} plan</p>
                                </div>
                                <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                                  <p className="text-sm font-semibold text-white">Billing status</p>
                                  <p className="mt-1 text-xs capitalize text-zinc-500">{authUser?.billingState?.replace(/_/g, " ") ?? "local only"}</p>
                                </div>
                              </div>

                              {authUser ? (
                                <>
                                  <div className="mt-3 rounded-md border border-emerald-300/15 bg-emerald-300/10 p-3">
                                    <p className="text-sm font-semibold text-emerald-100">
                                      {authUser.membershipStatus === "trialing"
                                        ? `Trial active${authUser.trialEndsAt ? ` through ${new Date(authUser.trialEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}`
                                        : authUser.billingState === "checkout_pending"
                                          ? "Billing setup is the next step"
                                          : "Billing will plug in here cleanly once Stripe is connected"}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-emerald-50/80">
                                      {authUser.billingState === "checkout_pending"
                                        ? "You can pick your plan now and keep the billing email ready. Checkout session creation will connect to Stripe next."
                                        : "We are keeping the account-side state ready first so the Stripe hookup can land without reshaping the profile flow later."}
                                    </p>
                                  </div>

                                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                                    {(["free", "pro", "team"] as const).map((plan) => (
                                      <button
                                        key={plan}
                                        type="button"
                                        onClick={() => setMembershipPlanDraft(plan)}
                                        className={[
                                          "rounded-md border px-3 py-3 text-left transition",
                                          membershipPlanDraft === plan
                                            ? "border-emerald-300/35 bg-emerald-300/10"
                                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                                        ].join(" ")}
                                      >
                                        <p className="text-sm font-semibold capitalize text-white">{plan}</p>
                                        <p className="mt-1 text-xs text-zinc-500">
                                          {plan === "free"
                                            ? "Core training tools"
                                            : plan === "pro"
                                              ? "Extra analysis and premium study features"
                                              : "Shared team tools and coaching workflows"}
                                        </p>
                                      </button>
                                    ))}
                                  </div>

                                  <label className="mt-3 block text-sm">
                                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Billing email</span>
                                    <input
                                      type="email"
                                      value={membershipBillingEmailDraft}
                                      onChange={(event) => setMembershipBillingEmailDraft(event.target.value)}
                                      placeholder="you@example.com"
                                      className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
                                    />
                                  </label>

                                  {membershipPlanDraft !== "free" ? (
                                    <div className="mt-3">
                                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                                        {membershipPlanDraft === "team" ? "Checkout option" : "Billing cycle"}
                                      </p>
                                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                                        {membershipPlanDraft === "team" ? (
                                          <div className="rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-3">
                                            <p className="text-sm font-semibold text-white">Team billing</p>
                                            <p className="mt-1 text-xs leading-5 text-zinc-400">
                                              Route this through the dedicated Stripe team price once the environment keys are in place.
                                            </p>
                                          </div>
                                        ) : (
                                          <>
                                            {([
                                              { id: "monthly", label: "$5 / month", note: "Flexible month-to-month access" },
                                              { id: "yearly", label: "$39 / year", note: "Best value for full-year training" }
                                            ] as const).map((cycle) => (
                                              <button
                                                key={cycle.id}
                                                type="button"
                                                onClick={() => setMembershipBillingCycleDraft(cycle.id)}
                                                className={[
                                                  "rounded-md border px-3 py-3 text-left transition",
                                                  membershipBillingCycleDraft === cycle.id
                                                    ? "border-emerald-300/35 bg-emerald-300/10"
                                                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                                                ].join(" ")}
                                              >
                                                <p className="text-sm font-semibold text-white">{cycle.label}</p>
                                                <p className="mt-1 text-xs text-zinc-500">{cycle.note}</p>
                                              </button>
                                            ))}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ) : null}

                                  {membershipError ? <p className="mt-3 text-xs text-rose-300">{membershipError}</p> : null}
                                  {membershipMessage ? <p className="mt-3 text-xs text-emerald-200">{membershipMessage}</p> : null}

                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleMembershipSave()}
                                      disabled={isSavingMembership}
                                      className="rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isSavingMembership ? "Saving..." : "Save membership"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMembershipPlanDraft(authUser.membershipPlan);
                                        setMembershipBillingCycleDraft(authUser.billingCycle ?? "monthly");
                                        setMembershipBillingEmailDraft(authUser.billingEmail);
                                        setMembershipError("");
                                        setMembershipMessage("");
                                      }}
                                      className="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300"
                                    >
                                      Reset changes
                                    </button>
                                    {membershipPlanDraft !== "free" ? (
                                      <button
                                        type="button"
                                        onClick={() => void handleStripeCheckout()}
                                        disabled={isSavingMembership}
                                        className="rounded-md bg-emerald-300 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {isSavingMembership ? "Opening checkout..." : "Continue to Stripe"}
                                      </button>
                                    ) : null}
                                  </div>

                                  <p className="mt-3 text-xs leading-5 text-zinc-500">
                                    Paid plans now open a real Stripe checkout session here. Webhook-based billing truth still comes next, but customer and subscription linking are ready to attach cleanly.
                                  </p>
                                </>
                              ) : (
                                <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                                  Sign in first and we can save your membership plan and billing email to your account.
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Sound feedback</p>
                            <p className="mt-1 text-xs leading-5 text-zinc-500">Turn trainer sounds on or off across the app.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSoundEnabled((current) => !current)}
                            className={[
                              "rounded-md border px-3 py-2 text-xs font-semibold transition",
                              soundEnabled
                                ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                                : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                            ].join(" ")}
                          >
                            {soundEnabled ? "Sound on" : "Sound off"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Default training mode</p>
                            <p className="mt-1 text-xs leading-5 text-zinc-500">Choose whether the trainer opens in study mode or test mode.</p>
                          </div>
                          <div className="flex rounded-md border border-white/10 bg-black/20 p-1">
                            <button
                              type="button"
                              onClick={() => setTrainingMode("study")}
                              className={[
                                "rounded px-3 py-2 text-xs font-semibold transition",
                                trainingMode === "study" ? "bg-emerald-300 text-zinc-950" : "text-zinc-300 hover:bg-white/[0.05]"
                              ].join(" ")}
                            >
                              Study
                            </button>
                            <button
                              type="button"
                              onClick={() => setTrainingMode("test")}
                              className={[
                                "rounded px-3 py-2 text-xs font-semibold transition",
                                trainingMode === "test" ? "bg-emerald-300 text-zinc-950" : "text-zinc-300 hover:bg-white/[0.05]"
                              ].join(" ")}
                            >
                              Test
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </section>
            </>
          ) : (
            <>
              <AnalysisPage
                activeSection={activeAnalysisSection}
                onOpenCourseSuggestion={handleOpenCourseSuggestion}
                onOpenWeaknessTarget={handleOpenWeaknessTarget}
                availableCourses={allCourses}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}

function loadTrainingMode(): TrainingMode {
  if (typeof window === "undefined") {
    return "study";
  }

  const stored = window.localStorage.getItem(trainingModeStorageKey);
  return stored === "test" ? "test" : "study";
}

function saveTrainingMode(mode: TrainingMode): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(trainingModeStorageKey, mode);
}

function loadSoundEnabled(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const stored = window.localStorage.getItem(trainingSoundStorageKey);
  return stored === null ? true : stored === "true";
}

function saveSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(trainingSoundStorageKey, String(enabled));
}

function squareToNotation(square: Square): string {
  return `${String.fromCharCode(97 + square.file)}${8 - square.rank}`;
}

function mergeBoardAnnotations(base?: BoardAnnotations, extra?: BoardAnnotations): BoardAnnotations | undefined {
  if (!base && !extra) {
    return undefined;
  }

  return {
    arrows: [...(base?.arrows ?? []), ...(extra?.arrows ?? [])],
    circles: [...(base?.circles ?? []), ...(extra?.circles ?? [])]
  };
}

function filterCourseCatalog(courses: OpeningCourse[], query: string): OpeningCourse[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return courses;
  }

  return courses.filter((course) => {
    const sections = Array.from(new Set(getCourseLines(course).map((line) => line.section).filter(Boolean))).join(" ");
    const searchableText = [course.name, course.description, course.level, course.repertoire, sections].join(" ").toLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}

function getCourseLines(course: OpeningCourse): TrainingLine[] {
  return Array.isArray(course.lines) ? course.lines : [];
}

function hasUsableCourse(course: OpeningCourse): boolean {
  return getCourseLines(course).length > 0;
}

function tokenizeWeaknessPattern(pattern: string): string[] {
  return pattern
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !["the", "and", "for", "with", "line", "main"].includes(token));
}

function loadFavoriteLinesSnapshot(): Record<string, true> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem("blounderproof:favorite-lines:v1");
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadLocalProfile(): LocalProfile {
  if (typeof window === "undefined") {
    return { name: "Blounderproof player", email: "" };
  }

  try {
    const stored = window.localStorage.getItem(localProfileStorageKey);
    const parsed = stored ? JSON.parse(stored) : {};
    return {
      name: typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name : "Blounderproof player",
      email: typeof parsed?.email === "string" ? parsed.email : ""
    };
  } catch {
    return { name: "Blounderproof player", email: "" };
  }
}

function saveLocalProfile(profile: LocalProfile): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(localProfileStorageKey, JSON.stringify(profile));
}

function loadStoredReferralAttribution(): ReferralBanner {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(referralAttributionStorageKey);
    const parsed = stored ? (JSON.parse(stored) as Partial<{ affiliateName: string; referralCode: string }>) : null;

    if (typeof parsed?.affiliateName === "string" && typeof parsed?.referralCode === "string") {
      return {
        affiliateName: parsed.affiliateName,
        referralCode: parsed.referralCode
      };
    }
  } catch {
    return null;
  }

  return null;
}

function saveStoredReferralAttribution(attribution: ReferralBanner): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!attribution) {
    window.localStorage.removeItem(referralAttributionStorageKey);
    return;
  }

  window.localStorage.setItem(referralAttributionStorageKey, JSON.stringify(attribution));
}

function getProfileInitials(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    return "BP";
  }

  const parts = trimmed.split(/\s+/).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");

  return initials || "BP";
}

function loadBoardThemeId(): string {
  if (typeof window === "undefined") {
    return "classic";
  }

  const stored = window.localStorage.getItem(boardThemeStorageKey);
  return boardThemes.some((theme) => theme.id === stored) ? (stored as string) : "classic";
}

function saveBoardThemeId(themeId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(boardThemeStorageKey, themeId);
}

function CompletionConfetti() {
  const pieces = Array.from({ length: 32 }, (_, index) => ({
    id: index,
    left: 4 + (index % 16) * 6.1 + ((index * 11) % 4),
    delay: (index % 8) * 45,
    duration: 900 + (index % 6) * 120,
    rotation: index % 2 === 0 ? 22 : -22,
    color: ["#6ee7b7", "#facc15", "#60a5fa", "#f472b6", "#f97316", "#a78bfa"][index % 6]
  }));
  const stars = Array.from({ length: 8 }, (_, index) => ({
    id: index,
    left: 10 + index * 10.5 + ((index * 7) % 4),
    delay: 90 + index * 70,
    duration: 920 + (index % 3) * 140,
    drift: `${index % 2 === 0 ? "-" : ""}${16 + (index % 4) * 10}px`,
    color: ["#fde68a", "#fef08a", "#f9a8d4", "#bfdbfe"][index % 4],
    size: index % 2 === 0 ? 16 : 14
  }));

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-lg">
      <style>{`
        @keyframes bp-confetti-fall {
          0% { transform: translate3d(0, -24px, 0) rotate(var(--bp-rotate)); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate3d(var(--bp-drift), 300px, 0) rotate(calc(var(--bp-rotate) * 4)); opacity: 0; }
        }
        @keyframes bp-star-fall {
          0% { transform: translate3d(0, -20px, 0) scale(0.75) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translate3d(var(--bp-star-drift), 250px, 0) scale(1.05) rotate(160deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            animation: `bp-confetti-fall ${piece.duration}ms ease-out ${piece.delay}ms forwards`,
            width: piece.id % 3 === 0 ? "10px" : "8px",
            height: piece.id % 4 === 0 ? "16px" : "12px",
            ["--bp-rotate" as string]: `${piece.rotation}deg`,
            ["--bp-drift" as string]: `${piece.id % 2 === 0 ? "-" : ""}${14 + (piece.id % 5) * 10}px`
          }}
        />
      ))}
      {stars.map((star) => (
        <span
          key={`star-${star.id}`}
          className="absolute top-0 grid place-items-center text-center leading-none"
          style={{
            left: `${star.left}%`,
            color: star.color,
            fontSize: `${star.size}px`,
            textShadow: "0 0 10px rgba(255,255,255,0.2)",
            animation: `bp-star-fall ${star.duration}ms ease-out ${star.delay}ms forwards`,
            ["--bp-star-drift" as string]: star.drift
          }}
        >
          â˜…
        </span>
      ))}
    </div>
  );
}

function ProfileBoardPreview({ board, theme }: { board: Board; theme: BoardTheme }) {
  const pieceGlyph: Record<PieceColor, Record<PieceType, string>> = {
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

  return (
    <div className="grid aspect-square w-full max-w-[360px] grid-cols-8 overflow-hidden rounded-lg border border-white/10">
      {board.map((rank, rankIndex) =>
        rank.map((piece, fileIndex) => {
          const isLight = (fileIndex + rankIndex) % 2 === 0;

          return (
            <div
              key={`${fileIndex}-${rankIndex}`}
              className={[
                "grid aspect-square place-items-center select-none text-[18px] leading-none sm:text-[22px]",
                piece?.color === "white"
                  ? "text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.55)]"
                  : "text-zinc-950"
              ].join(" ")}
              style={{ backgroundColor: isLight ? theme.light : theme.dark }}
            >
              {piece ? pieceGlyph[piece.color][piece.type] : ""}
            </div>
          );
        })
      )}
    </div>
  );
}


