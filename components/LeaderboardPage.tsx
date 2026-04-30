"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpeningCourse } from "@/lib/courses";
import { type LeaderboardRange, buildPlayerLeaderboard, getFilteredCoursePlayEvents, type CoursePlayEvent, type PlayerLeaderboardEntry } from "@/lib/leaderboards";

type LeaderboardPageProps = {
  courses: OpeningCourse[];
  playEvents: CoursePlayEvent[];
  onOpenCourse: (courseId: string) => void;
  range?: LeaderboardRange;
  onRangeChange?: (value: LeaderboardRange) => void;
};

export function LeaderboardPage({ courses, playEvents, onOpenCourse, range: externalRange, onRangeChange }: LeaderboardPageProps) {
  const [internalRange, setInternalRange] = useState<LeaderboardRange>("all");
  const range = externalRange ?? internalRange;
  const handleRangeChange = onRangeChange ?? setInternalRange;
  const filteredEvents = useMemo(() => getFilteredCoursePlayEvents(playEvents, range), [playEvents, range]);
  const playerLeaderboard = useMemo(() => buildPlayerLeaderboard(filteredEvents).slice(0, 12), [filteredEvents]);
  const rankedCourses = useMemo(() => {
    const playCounts = new Map<string, number>();

    for (const event of filteredEvents) {
      playCounts.set(event.courseId, (playCounts.get(event.courseId) ?? 0) + 1);
    }

    return [...courses]
      .map((course) => ({
        course,
        plays: playCounts.get(course.id) ?? 0
      }))
      .filter((entry) => entry.plays > 0)
      .sort((left, right) => right.plays - left.plays)
      .slice(0, 6);
  }, [courses, filteredEvents]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Leaderboards</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Who is putting in the most reps</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              This board tracks who is actually opening and playing courses most often, so it feels tied to real study work instead of just likes.
            </p>
          </div>
          <LeaderboardRangeTabs value={range} onChange={handleRangeChange} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">Overall leaderboard</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Most course plays</h2>
          <div className="mt-4 space-y-2">
            {playerLeaderboard.length ? (
              playerLeaderboard.map((entry, index) => (
                <PlayerLeaderboardRow key={entry.userId} entry={entry} rank={index + 1} />
              ))
            ) : (
              <EmptyLeaderboardState range={range} />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">Most played courses</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Popular in this window</h2>
          <div className="mt-4 space-y-2">
            {rankedCourses.length ? (
              rankedCourses.map(({ course, plays }, index) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onOpenCourse(course.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:bg-white/[0.05]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-300/10 text-[11px] font-semibold text-violet-100">
                        {index + 1}
                      </span>
                      <p className="truncate text-sm font-semibold text-white">{course.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 capitalize">
                      {course.repertoire} repertoire · {course.lines.length} lessons
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold text-zinc-300">
                    {plays} plays
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-sm text-zinc-500">
                No courses have been played in this time window yet.
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

export function LeaderboardRangeTabs({
  value,
  onChange,
  compact = false
}: {
  value: LeaderboardRange;
  onChange: (value: LeaderboardRange) => void;
  compact?: boolean;
}) {
  const options: Array<{ value: LeaderboardRange; label: string }> = compact
    ? [
        { value: "all", label: "All time" },
        { value: "week", label: "This week" },
        { value: "day", label: "Today" }
      ]
    : [
        { value: "all", label: "All time" },
        { value: "week", label: "This week" },
        { value: "day", label: "Today" }
      ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={[
            "rounded-md px-3 py-2 text-sm font-semibold transition",
            value === option.value ? "bg-amber-300/15 text-amber-100" : "text-zinc-300 hover:bg-white/[0.05]"
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CourseLeaderboardCard({
  course,
  playEvents,
  range,
  onRangeChange
}: {
  course: OpeningCourse;
  playEvents: CoursePlayEvent[];
  range: LeaderboardRange;
  onRangeChange: (range: LeaderboardRange) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const entries = useMemo(() => buildPlayerLeaderboard(getFilteredCoursePlayEvents(playEvents, range).filter((event) => event.courseId === course.id)).slice(0, 5), [course.id, playEvents, range]);

  useEffect(() => {
    setIsOpen(false);
  }, [course.id]);

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-md text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-amber-300/20 bg-amber-300/10 text-amber-100">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
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
          {isOpen ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">Course leaderboard</p>
              <h3 className="mt-1 text-base font-semibold text-white">{course.name}</h3>
            </div>
          ) : null}
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold text-zinc-400">
          {isOpen ? "Hide" : "Open"}
        </span>
      </button>

      {isOpen ? (
        <div className="mt-4 space-y-4">
          <LeaderboardRangeTabs value={range} onChange={onRangeChange} compact />
          <div className="space-y-2">
            {entries.length ? (
              entries.map((entry, index) => <PlayerLeaderboardRow key={entry.userId} entry={entry} rank={index + 1} compact />)
            ) : (
              <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-sm text-zinc-500">
                No one has logged a course play here in this window yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PlayerLeaderboardRow({ entry, rank, compact = false }: { entry: PlayerLeaderboardEntry; rank: number; compact?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-300/10 text-[11px] font-semibold text-amber-100">
            {rank}
          </span>
          <p className="truncate text-sm font-semibold text-white">{entry.userName}</p>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {entry.courseCount} {entry.courseCount === 1 ? "course" : "courses"} touched
        </p>
      </div>
      <span className={["shrink-0 rounded-full border border-white/10 px-2 py-1 text-[11px] font-semibold text-zinc-300", compact ? "" : ""].join(" ")}>
        {entry.plays} plays
      </span>
    </div>
  );
}

function EmptyLeaderboardState({ range }: { range: LeaderboardRange }) {
  const label = range === "all" ? "all time" : range === "week" ? "this week" : "today";

  return (
    <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-5 text-sm text-zinc-500">
      Nobody has logged any course plays for {label} yet.
    </div>
  );
}
