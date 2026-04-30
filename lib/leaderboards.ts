import type { AuthUser } from "@/lib/auth";

export type LeaderboardRange = "all" | "week" | "day";

export type CoursePlayEvent = {
  userId: string;
  userName: string;
  courseId: string;
  playedAt: string;
};

export type PlayerLeaderboardEntry = {
  userId: string;
  userName: string;
  plays: number;
  courseCount: number;
  lastPlayedAt: string;
};

const coursePlayLogStorageKey = "blounderproof:course-play-log:v1";
const duplicateWindowMs = 10 * 60 * 1000;

export function loadCoursePlayEvents(): CoursePlayEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(coursePlayLogStorageKey);
    const parsed = stored ? JSON.parse(stored) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isCoursePlayEvent);
  } catch {
    return [];
  }
}

export function recordCoursePlay(user: AuthUser | null, courseId: string, now = new Date()): CoursePlayEvent[] {
  if (!user || typeof window === "undefined") {
    return loadCoursePlayEvents();
  }

  const current = loadCoursePlayEvents();
  const nowValue = now.getTime();
  const recentDuplicate = current.find(
    (event) =>
      event.userId === user.id &&
      event.courseId === courseId &&
      nowValue - new Date(event.playedAt).getTime() < duplicateWindowMs
  );

  if (recentDuplicate) {
    return current;
  }

  const nextEvent: CoursePlayEvent = {
    userId: user.id,
    userName: user.name,
    courseId,
    playedAt: now.toISOString()
  };
  const next = [nextEvent, ...current].slice(0, 5000);

  window.localStorage.setItem(coursePlayLogStorageKey, JSON.stringify(next));
  return next;
}

export function getFilteredCoursePlayEvents(events: CoursePlayEvent[], range: LeaderboardRange, now = new Date()): CoursePlayEvent[] {
  if (range === "all") {
    return events;
  }

  const threshold = range === "day" ? startOfDay(now).getTime() : startOfWeek(now).getTime();
  return events.filter((event) => new Date(event.playedAt).getTime() >= threshold);
}

export function buildPlayerLeaderboard(events: CoursePlayEvent[]): PlayerLeaderboardEntry[] {
  const leaderboard = new Map<string, PlayerLeaderboardEntry & { courseIds: Set<string> }>();

  for (const event of events) {
    const current = leaderboard.get(event.userId) ?? {
      userId: event.userId,
      userName: event.userName,
      plays: 0,
      courseCount: 0,
      lastPlayedAt: event.playedAt,
      courseIds: new Set<string>()
    };

    current.userName = event.userName;
    current.plays += 1;
    current.courseIds.add(event.courseId);
    if (new Date(event.playedAt).getTime() > new Date(current.lastPlayedAt).getTime()) {
      current.lastPlayedAt = event.playedAt;
    }

    leaderboard.set(event.userId, current);
  }

  return Array.from(leaderboard.values())
    .map(({ courseIds, ...entry }) => ({
      ...entry,
      courseCount: courseIds.size
    }))
    .sort((left, right) => {
      if (right.plays !== left.plays) {
        return right.plays - left.plays;
      }

      if (right.courseCount !== left.courseCount) {
        return right.courseCount - left.courseCount;
      }

      return new Date(right.lastPlayedAt).getTime() - new Date(left.lastPlayedAt).getTime();
    });
}

export function buildCourseLeaderboard(events: CoursePlayEvent[], courseId: string): PlayerLeaderboardEntry[] {
  return buildPlayerLeaderboard(events.filter((event) => event.courseId === courseId));
}

function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfWeek(now: Date): Date {
  const current = startOfDay(now);
  const day = current.getDay();
  current.setDate(current.getDate() - day);
  return current;
}

function isCoursePlayEvent(value: unknown): value is CoursePlayEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<CoursePlayEvent>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.userName === "string" &&
    typeof candidate.courseId === "string" &&
    typeof candidate.playedAt === "string"
  );
}
