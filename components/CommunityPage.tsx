"use client";

import { useMemo, useState } from "react";
import type { OpeningCourse } from "@/lib/courses";

type CommunityPageProps = {
  courses: OpeningCourse[];
  onOpenCourse: (courseId: string) => void;
  onRateCourse: (courseId: string, delta: 1 | -1) => void;
};

type CommunitySort = "top" | "newest";
type CommunityFilter = "all" | "openings" | "endgames";
type RepertoireFilter = "all" | "white" | "black";

export function CommunityPage({ courses, onOpenCourse, onRateCourse }: CommunityPageProps) {
  const [sort, setSort] = useState<CommunitySort>("top");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CommunityFilter>("all");
  const [repertoireFilter, setRepertoireFilter] = useState<RepertoireFilter>("all");
  const creatorLeaderboard = useMemo(() => buildCreatorLeaderboard(courses).slice(0, 5), [courses]);
  const featuredCreators = useMemo(() => buildCreatorLeaderboard(courses).slice(0, 3), [courses]);
  const trendingCourses = useMemo(
    () =>
      [...courses]
        .sort((left, right) => getTrendingScore(right) - getTrendingScore(left))
        .slice(0, 3),
    [courses]
  );
  const openingLeaderboard = useMemo(
    () => [...courses].filter((course) => inferCourseType(course) === "openings").sort((left, right) => getCommunityScore(right) - getCommunityScore(left)).slice(0, 5),
    [courses]
  );
  const endgameLeaderboard = useMemo(
    () => [...courses].filter((course) => inferCourseType(course) === "endgames").sort((left, right) => getCommunityScore(right) - getCommunityScore(left)).slice(0, 5),
    [courses]
  );
  const overallRankMap = useMemo(
    () => new Map([...courses].sort((left, right) => getCommunityScore(right) - getCommunityScore(left)).map((course, index) => [course.id, index + 1])),
    [courses]
  );
  const typeRankMap = useMemo(() => {
    const next = new Map<string, number>();

    for (const type of ["openings", "endgames"] as const) {
      const typedCourses = [...courses]
        .filter((course) => inferCourseType(course) === type)
        .sort((left, right) => getCommunityScore(right) - getCommunityScore(left));

      typedCourses.forEach((course, index) => {
        next.set(course.id, index + 1);
      });
    }

    return next;
  }, [courses]);

  const sortedCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = [...courses].filter((course) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "endgames"
            ? inferCourseType(course) === "endgames"
            : inferCourseType(course) === "openings";

      if (!matchesFilter) {
        return false;
      }

      if (repertoireFilter !== "all" && course.repertoire !== repertoireFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        course.name,
        course.description,
        course.creator?.name ?? "",
        course.repertoire,
        course.level,
        ...getCourseLines(course).map((line) => `${line.name} ${line.section ?? ""}`)
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });

    if (sort === "newest") {
      return next.sort((left, right) => getCreatedAtValue(right) - getCreatedAtValue(left));
    }

    return next.sort((left, right) => getCommunityScore(right) - getCommunityScore(left));
  }, [courses, filter, query, repertoireFilter, sort]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Community</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Shared courses from creators</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Browse community-made lines, open them directly into the trainer, and vote the strongest ones upward.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] p-1">
            <SortButton isActive={sort === "top"} onClick={() => setSort("top")}>
              Top
            </SortButton>
            <SortButton isActive={sort === "newest"} onClick={() => setSort("newest")}>
              Newest
            </SortButton>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by course, creator, line, white, or black"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterButton isActive={filter === "all"} onClick={() => setFilter("all")}>
              All
            </FilterButton>
            <FilterButton isActive={filter === "openings"} onClick={() => setFilter("openings")}>
              Openings
            </FilterButton>
            <FilterButton isActive={filter === "endgames"} onClick={() => setFilter("endgames")}>
              Endgames
            </FilterButton>
            <FilterButton isActive={repertoireFilter === "white"} onClick={() => setRepertoireFilter((current) => (current === "white" ? "all" : "white"))}>
              White
            </FilterButton>
            <FilterButton isActive={repertoireFilter === "black"} onClick={() => setRepertoireFilter((current) => (current === "black" ? "all" : "black"))}>
              Black
            </FilterButton>
          </div>
        </div>
      </section>

      {courses.length ? (
        <section className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">Featured creators</p>
            <h2 className="mt-2 text-lg font-semibold text-white">People shaping the library</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {featuredCreators.map((creator, index) => (
                <div key={creator.name} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-violet-300/12 text-sm font-semibold text-violet-100">
                      {getCreatorInitials(creator.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
                      <p className="mt-1 text-xs text-zinc-500">Rank #{index + 1}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded-full border border-white/10 px-2 py-1">{creator.courseCount} shared</span>
                    <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-violet-100">
                      {creator.likes} likes
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200">Trending this week</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Fresh courses picking up momentum</h2>
            <div className="mt-4 space-y-3">
              {trendingCourses.map((course, index) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onOpenCourse(course.id)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-300/12 text-[11px] font-semibold text-amber-100">
                          {index + 1}
                        </span>
                        <p className="truncate text-sm font-semibold text-white">{course.name}</p>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{course.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-1 text-[11px] capitalize text-zinc-300">
                      {course.repertoire}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                    <span className="rounded-full border border-white/10 px-2 py-1">by {course.creator?.name ?? "Anonymous"}</span>
                    <span className="rounded-full border border-white/10 px-2 py-1">{getCourseLines(course).length} lines</span>
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-amber-100">
                      Trend {Math.round(getTrendingScore(course))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </section>
      ) : null}

      {courses.length ? (
        <section className="grid gap-3 xl:grid-cols-3">
          <LeaderboardCard
            eyebrow="Overall leaderboard"
            title="Top creators"
            items={creatorLeaderboard.map((entry) => ({
              key: entry.name,
              title: entry.name,
              meta: `${entry.courseCount} shared courses`,
              value: `${entry.likes} likes`
            }))}
          />
          <LeaderboardCard
            eyebrow="Per course"
            title="Top opening courses"
            items={openingLeaderboard.map((course) => ({
              key: course.id,
              title: course.name,
              meta: `by ${course.creator?.name ?? "Anonymous"}`,
              value: `${course.engagement?.likes ?? 0} likes`
            }))}
          />
          <LeaderboardCard
            eyebrow="Per course"
            title="Top endgame courses"
            items={endgameLeaderboard.map((course) => ({
              key: course.id,
              title: course.name,
              meta: `by ${course.creator?.name ?? "Anonymous"}`,
              value: `${course.engagement?.likes ?? 0} likes`
            }))}
          />
        </section>
      ) : null}

      {sortedCourses.length ? (
        <section className="grid gap-3 lg:grid-cols-3">
          {sortedCourses.map((course) => (
            <div key={course.id} className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Community</p>
                  <h2 className="mt-2 truncate text-lg font-semibold text-white">{course.name}</h2>
                </div>
                <span className="rounded-full bg-violet-300/10 px-2 py-1 text-[11px] capitalize text-violet-100">{course.repertoire}</span>
              </div>

              <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-400">{course.description}</p>

              <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-300/12 text-sm font-semibold text-violet-100">
                  {getCreatorInitials(course.creator?.name ?? "Anonymous")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{course.creator?.name ?? "Anonymous"}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatCreatorRank(creatorLeaderboard.findIndex((entry) => entry.name === course.creator?.name))} in creator leaderboard
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-violet-100">
                  Overall #{overallRankMap.get(course.id) ?? "-"}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-1 capitalize">
                  {inferCourseType(course)} #{typeRankMap.get(course.id) ?? "-"}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-1">{getCourseLines(course).length} lines</span>
                <span className="rounded-full border border-white/10 px-2 py-1">by {course.creator?.name ?? "Anonymous"}</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{course.engagement?.likes ?? 0} likes</span>
                <span className="rounded-full border border-white/10 px-2 py-1">{(course.engagement?.rating ?? 0).toFixed(1)} rating</span>
                <span className="rounded-full border border-white/10 px-2 py-1 capitalize">{inferCourseType(course)}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenCourse(course.id)}
                  className="rounded-md border border-emerald-300/25 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/10"
                >
                  Open course
                </button>
                <button
                  type="button"
                  onClick={() => onRateCourse(course.id, 1)}
                  className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                >
                  Like
                </button>
                <button
                  type="button"
                  onClick={() => onRateCourse(course.id, -1)}
                  className="rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
                >
                  Downvote
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-white/10 bg-zinc-950/40 p-6 text-sm text-zinc-400">
          {courses.length
            ? "No community courses match that search or filter yet."
            : "No shared community courses yet. Save a manual course with community sharing turned on and it will show up here."}
        </section>
      )}
    </div>
  );
}

export function LeaderboardCard({
  eyebrow,
  title,
  items
}: {
  eyebrow: string;
  title: string;
  items: Array<{ key: string; title: string; meta: string; value: string }>;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/55 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.length ? (
          items.map((item, index) => (
            <div key={item.key} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-300/10 text-[11px] font-semibold text-violet-100">
                    {index + 1}
                  </span>
                  <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{item.meta}</p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-zinc-300">{item.value}</span>
            </div>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-4 text-sm text-zinc-500">
            Nothing ranked here yet.
          </div>
        )}
      </div>
    </section>
  );
}

function SortButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-3 py-2 text-sm font-semibold transition",
        isActive ? "bg-violet-500 text-white" : "text-zinc-300 hover:bg-white/[0.05]"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function FilterButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-3 py-2 text-sm font-semibold transition",
        isActive
          ? "border-violet-300/30 bg-violet-300/10 text-violet-100"
          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function getCommunityScore(course: OpeningCourse): number {
  return (course.engagement?.likes ?? 0) + (course.engagement?.rating ?? 0) * 3;
}

function getCreatedAtValue(course: OpeningCourse): number {
  const timestamp = course.createdAt ? new Date(course.createdAt).getTime() : 0;

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp;
  }

  const idMatch = course.id.match(/(\d{10,})$/);
  return idMatch ? Number(idMatch[1]) : 0;
}

function getTrendingScore(course: OpeningCourse): number {
  const ageDays = Math.max(1, Math.floor((Date.now() - getCreatedAtValue(course)) / 86_400_000));
  return getCommunityScore(course) + Math.max(0, 21 - ageDays) * 2;
}

export function inferCourseType(course: OpeningCourse): "openings" | "endgames" {
  return /endgame|mate|lucena|philidor|opposition|pawn/.test(`${course.name} ${course.description}`.toLowerCase()) ? "endgames" : "openings";
}

export function buildCreatorLeaderboard(courses: OpeningCourse[]) {
  const creatorMap = new Map<string, { name: string; likes: number; courseCount: number }>();

  for (const course of courses) {
    const creatorName = course.creator?.name ?? "Anonymous";
    const current = creatorMap.get(creatorName) ?? {
      name: creatorName,
      likes: 0,
      courseCount: 0
    };

    current.likes += course.engagement?.likes ?? 0;
    current.courseCount += 1;
    creatorMap.set(creatorName, current);
  }

  return Array.from(creatorMap.values()).sort((left, right) => {
    if (right.likes !== left.likes) {
      return right.likes - left.likes;
    }

    return right.courseCount - left.courseCount;
  });
}

function getCreatorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "BP";
}

function getCourseLines(course: OpeningCourse) {
  return Array.isArray(course.lines) ? course.lines : [];
}

function formatCreatorRank(index: number): string {
  return index >= 0 ? `#${index + 1}` : "Unranked";
}
