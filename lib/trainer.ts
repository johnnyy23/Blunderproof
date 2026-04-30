import type { OpeningCourse, TrainingLine, TrainingMove } from "@/lib/courses";
import type { ReviewGrade } from "@/types/chess";

const progressStorageKey = "blounderproof:trainer-progress:v1";

export type LineProgress = {
  attempts: number;
  correct: number;
  revealed: number;
  streak: number;
  ease: number;
  intervalDays: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt?: string;
};

export type DailyStreak = {
  current: number;
  best: number;
  lastActiveOn?: string;
};

export type ActivityDay = {
  date: string;
  attempts: number;
  correct: number;
  revealed: number;
  completedLines: number;
};

export type TrainerProgress = {
  attempts: number;
  correct: number;
  revealed: number;
  streak: DailyStreak;
  activity: ActivityDay[];
  lines: Record<string, LineProgress>;
};

export type LineStatus = "new" | "learning" | "shaky" | "solid" | "mastered";

export const initialProgress: TrainerProgress = {
  attempts: 0,
  correct: 0,
  revealed: 0,
  streak: {
    current: 0,
    best: 0
  },
  activity: [],
  lines: {}
};

export function getCurrentTrainingMove(line: TrainingLine, moveIndex: number): TrainingMove {
  return line.moves[Math.min(moveIndex, line.moves.length - 1)];
}

export function isExpectedMove(line: TrainingLine, moveIndex: number, uci: string): boolean {
  return getCurrentTrainingMove(line, moveIndex).uci === uci;
}

export function nextLineIndex(currentIndex: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (currentIndex + 1) % total;
}

export function previousLineIndex(currentIndex: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return (currentIndex - 1 + total) % total;
}

export function updateProgressForAnswer(progress: TrainerProgress, lineId: string, wasCorrect: boolean, isLineComplete = true, now = new Date()): TrainerProgress {
  return updateProgressForGrade(progress, lineId, wasCorrect ? "good" : "again", isLineComplete, now);
}

export function updateProgressForGrade(progress: TrainerProgress, lineId: string, grade: ReviewGrade, isLineComplete = true, now = new Date()): TrainerProgress {
  const existing = progress.lines[lineId] ?? createLineProgress(now);
  const schedule = calculateSchedule(now, existing, grade, isLineComplete);
  const wasCorrect = grade !== "again";

  return {
    attempts: progress.attempts + 1,
    correct: progress.correct + (wasCorrect ? 1 : 0),
    revealed: progress.revealed,
    streak: progress.streak,
    activity: recordActivity(progress.activity, now, {
      attempts: 1,
      correct: wasCorrect ? 1 : 0,
      revealed: 0,
      completedLines: wasCorrect && isLineComplete ? 1 : 0
    }),
    lines: {
      ...progress.lines,
      [lineId]: {
        attempts: existing.attempts + 1,
        correct: existing.correct + (wasCorrect ? 1 : 0),
        revealed: existing.revealed,
        streak: schedule.streak,
        ease: schedule.ease,
        intervalDays: schedule.intervalDays,
        lapses: schedule.lapses,
        dueAt: schedule.dueAt,
        lastReviewedAt: now.toISOString()
      }
    }
  };
}

export function rescheduleLineForGrade(progress: TrainerProgress, lineId: string, grade: ReviewGrade, now = new Date()): TrainerProgress {
  const existing = progress.lines[lineId] ?? createLineProgress(now);
  const schedule = calculateSchedule(now, existing, grade, true);

  return {
    ...progress,
    lines: {
      ...progress.lines,
      [lineId]: {
        ...existing,
        streak: schedule.streak,
        ease: schedule.ease,
        intervalDays: schedule.intervalDays,
        lapses: schedule.lapses,
        dueAt: schedule.dueAt,
        lastReviewedAt: now.toISOString()
      }
    }
  };
}

export function updateProgressForReveal(progress: TrainerProgress, lineId: string, now = new Date()): TrainerProgress {
  const existing = progress.lines[lineId] ?? createLineProgress(now);

  return {
    attempts: progress.attempts,
    correct: progress.correct,
    revealed: progress.revealed + 1,
    streak: progress.streak,
    activity: recordActivity(progress.activity, now, {
      attempts: 0,
      correct: 0,
      revealed: 1,
      completedLines: 0
    }),
    lines: {
      ...progress.lines,
      [lineId]: {
        attempts: existing.attempts,
        correct: existing.correct,
        revealed: existing.revealed + 1,
        streak: 0,
        ease: Math.max(1, existing.ease - 0.15),
        intervalDays: 0,
        lapses: existing.lapses + 1,
        dueAt: now.toISOString(),
        lastReviewedAt: now.toISOString()
      }
    }
  };
}

export function accuracy(progress: TrainerProgress): number {
  if (progress.attempts === 0) {
    return 0;
  }

  return Math.round((progress.correct / progress.attempts) * 100);
}

export function reviewedLineCount(course: OpeningCourse, progress: TrainerProgress): number {
  return course.lines.filter((line) => Boolean(progress.lines[line.id]?.lastReviewedAt)).length;
}

export function getDueLines(course: OpeningCourse, progress: TrainerProgress, now = new Date()): TrainingLine[] {
  return course.lines.filter((line) => isLineDue(line, progress, now));
}

export function getMistakeReviewLines(course: OpeningCourse, progress: TrainerProgress, now = new Date()): TrainingLine[] {
  return [...course.lines]
    .filter((line) => isMistakeReviewLine(line, progress, now))
    .sort((left, right) => getMistakeScore(right, progress, now) - getMistakeScore(left, progress, now));
}

export function isLineDue(line: TrainingLine, progress: TrainerProgress, now = new Date()): boolean {
  const lineProgress = progress.lines[line.id];

  if (!lineProgress) {
    return line.dueLevel !== "steady";
  }

  return new Date(lineProgress.dueAt).getTime() <= now.getTime();
}

export function getLineStatus(line: TrainingLine, progress: TrainerProgress, now = new Date()): LineStatus {
  const lineProgress = progress.lines[line.id];

  if (!lineProgress?.lastReviewedAt) {
    return "new";
  }

  if (lineProgress.revealed > lineProgress.correct || lineProgress.lapses >= 3) {
    return "shaky";
  }

  if (lineProgress.intervalDays >= 7 && lineProgress.streak >= 4) {
    return "mastered";
  }

  if (lineProgress.intervalDays >= 2 && lineProgress.streak >= 2 && new Date(lineProgress.dueAt).getTime() > now.getTime()) {
    return "solid";
  }

  return "learning";
}

export function isMistakeReviewLine(line: TrainingLine, progress: TrainerProgress, now = new Date()): boolean {
  const lineProgress = progress.lines[line.id];

  if (!lineProgress?.lastReviewedAt) {
    return false;
  }

  return getLineStatus(line, progress, now) === "shaky" || lineProgress.revealed > 0 || lineProgress.lapses > 0;
}

export function loadStoredProgress(): TrainerProgress {
  if (typeof window === "undefined") {
    return initialProgress;
  }

  try {
    const stored = window.localStorage.getItem(progressStorageKey);

    if (!stored) {
      return initialProgress;
    }

    return sanitizeProgress(JSON.parse(stored));
  } catch {
    return initialProgress;
  }
}

export function saveStoredProgress(progress: TrainerProgress): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
}

export function touchDailyStreak(progress: TrainerProgress, now = new Date()): TrainerProgress {
  const today = formatLocalDay(now);
  const yesterday = formatLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const existing = progress.streak ?? initialProgress.streak;

  if (existing.lastActiveOn === today) {
    return progress;
  }

  const nextCurrent = existing.lastActiveOn === yesterday ? existing.current + 1 : 1;

  return {
    ...progress,
    streak: {
      current: nextCurrent,
      best: Math.max(existing.best, nextCurrent),
      lastActiveOn: today
    },
    activity: ensureActivityDay(progress.activity, today)
  };
}

export function getRecentActivity(progress: TrainerProgress, days = 7, now = new Date()): ActivityDay[] {
  const activityByDay = new Map(progress.activity.map((day) => [day.date, day]));
  const recentDays: ActivityDay[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = formatLocalDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
    recentDays.push(
      activityByDay.get(date) ?? {
        date,
        attempts: 0,
        correct: 0,
        revealed: 0,
        completedLines: 0
      }
    );
  }

  return recentDays;
}

function createLineProgress(now: Date): LineProgress {
  return {
    attempts: 0,
    correct: 0,
    revealed: 0,
    streak: 0,
    ease: 1.8,
    intervalDays: 0,
    lapses: 0,
    dueAt: now.toISOString()
  };
}

function calculateSchedule(now: Date, existing: LineProgress, grade: ReviewGrade, isLineComplete: boolean): Pick<LineProgress, "dueAt" | "ease" | "intervalDays" | "lapses" | "streak"> {
  if (grade === "again" || !isLineComplete) {
    return {
      dueAt: now.toISOString(),
      ease: Math.max(1, existing.ease - 0.25),
      intervalDays: 0,
      lapses: grade === "again" ? existing.lapses + 1 : existing.lapses,
      streak: grade === "again" ? 0 : existing.streak + 1
    };
  }

  const easeDelta: Record<Exclude<ReviewGrade, "again">, number> = {
    hard: -0.1,
    good: 0.12,
    easy: 0.28
  };
  const intervalMultiplier: Record<Exclude<ReviewGrade, "again">, number> = {
    hard: 1.15,
    good: existing.ease,
    easy: existing.ease + 0.85
  };
  const nextEase = Math.min(3.2, Math.max(1.15, existing.ease + easeDelta[grade]));
  const baseInterval = existing.intervalDays > 0 ? existing.intervalDays : 1;
  const days = Math.min(60, Math.max(1, Math.round(baseInterval * intervalMultiplier[grade])));
  const next = new Date(now);
  next.setDate(next.getDate() + days);

  return {
    dueAt: next.toISOString(),
    ease: nextEase,
    intervalDays: days,
    lapses: existing.lapses,
    streak: existing.streak + 1
  };
}

function sanitizeProgress(value: unknown): TrainerProgress {
  if (!value || typeof value !== "object") {
    return initialProgress;
  }

  const progress = value as Partial<TrainerProgress>;

  return {
    attempts: typeof progress.attempts === "number" ? progress.attempts : 0,
    correct: typeof progress.correct === "number" ? progress.correct : 0,
    revealed: typeof progress.revealed === "number" ? progress.revealed : 0,
    streak: sanitizeDailyStreak(progress.streak),
    activity: sanitizeActivity(progress.activity),
    lines: sanitizeLines(progress.lines)
  };
}

function sanitizeDailyStreak(value: unknown): DailyStreak {
  if (!value || typeof value !== "object") {
    return initialProgress.streak;
  }

  const streak = value as Partial<DailyStreak>;

  return {
    current: typeof streak.current === "number" ? streak.current : 0,
    best: typeof streak.best === "number" ? streak.best : 0,
    lastActiveOn: typeof streak.lastActiveOn === "string" ? streak.lastActiveOn : undefined
  };
}

function sanitizeLines(value: unknown): Record<string, LineProgress> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, Partial<LineProgress>>).map(([lineId, line]) => [
      lineId,
      {
        attempts: typeof line.attempts === "number" ? line.attempts : 0,
        correct: typeof line.correct === "number" ? line.correct : 0,
        revealed: typeof line.revealed === "number" ? line.revealed : 0,
        streak: typeof line.streak === "number" ? line.streak : 0,
        ease: typeof line.ease === "number" ? line.ease : 1.8,
        intervalDays: typeof line.intervalDays === "number" ? line.intervalDays : 0,
        lapses: typeof line.lapses === "number" ? line.lapses : 0,
        dueAt: typeof line.dueAt === "string" ? line.dueAt : new Date().toISOString(),
        lastReviewedAt: typeof line.lastReviewedAt === "string" ? line.lastReviewedAt : undefined
      }
    ])
  );
}

function sanitizeActivity(value: unknown): ActivityDay[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((day) => {
      if (!day || typeof day !== "object") {
        return null;
      }

      const activityDay = day as Partial<ActivityDay>;

      if (typeof activityDay.date !== "string") {
        return null;
      }

      return {
        date: activityDay.date,
        attempts: typeof activityDay.attempts === "number" ? activityDay.attempts : 0,
        correct: typeof activityDay.correct === "number" ? activityDay.correct : 0,
        revealed: typeof activityDay.revealed === "number" ? activityDay.revealed : 0,
        completedLines: typeof activityDay.completedLines === "number" ? activityDay.completedLines : 0
      };
    })
    .filter((day): day is ActivityDay => day !== null)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-30);
}

export function formatLocalDay(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMistakeScore(line: TrainingLine, progress: TrainerProgress, now = new Date()): number {
  const lineProgress = progress.lines[line.id];

  if (!lineProgress) {
    return 0;
  }

  const shakyBonus = getLineStatus(line, progress, now) === "shaky" ? 6 : 0;
  const recencyBonus = lineProgress.lastReviewedAt ? Math.max(0, 3 - Math.floor((now.getTime() - new Date(lineProgress.lastReviewedAt).getTime()) / 86400000)) : 0;

  return lineProgress.revealed * 2 + lineProgress.lapses * 3 + shakyBonus + recencyBonus;
}

function recordActivity(activity: ActivityDay[], now: Date, update: Omit<ActivityDay, "date">): ActivityDay[] {
  const date = formatLocalDay(now);
  const nextActivity = ensureActivityDay(activity, date);
  const dayIndex = nextActivity.findIndex((day) => day.date === date);

  if (dayIndex === -1) {
    return nextActivity;
  }

  const current = nextActivity[dayIndex];
  nextActivity[dayIndex] = {
    date,
    attempts: current.attempts + update.attempts,
    correct: current.correct + update.correct,
    revealed: current.revealed + update.revealed,
    completedLines: current.completedLines + update.completedLines
  };

  return nextActivity;
}

function ensureActivityDay(activity: ActivityDay[], date: string): ActivityDay[] {
  const trimmed = [...activity].sort((left, right) => left.date.localeCompare(right.date)).slice(-29);

  if (trimmed.some((day) => day.date === date)) {
    return trimmed;
  }

  return [
    ...trimmed,
    {
      date,
      attempts: 0,
      correct: 0,
      revealed: 0,
      completedLines: 0
    }
  ];
}
