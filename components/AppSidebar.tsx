"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpeningCourse, TrainingLine } from "@/lib/courses";
import type { TrainerProgress } from "@/lib/trainer";
import { getLineStatus, isLineDue } from "@/lib/trainer";

const favoriteLinesStorageKey = "blounderproof:favorite-lines:v1";

export type AppPage = "courses" | "course" | "analysis" | "create" | "community" | "leaderboard" | "profile" | "affiliates";

type AnalysisSection = {
  id: string;
  label: string;
};

type AppSidebarProps = {
  page: AppPage;
  onPageChange: (page: AppPage) => void;
  isCompactCourseSidebar: boolean;
  onToggleCompactCourseSidebar: () => void;
  isCompactAnalysisSidebar: boolean;
  onToggleCompactAnalysisSidebar: () => void;
  courses: OpeningCourse[];
  activeCourseId: string;
  activeLineId: string;
  progress: TrainerProgress;
  onSelectLesson: (courseId: string, lineIndex: number) => void;
  analysisSections: AnalysisSection[];
  activeAnalysisSection: string;
  onSelectAnalysisSection: (sectionId: string) => void;
};

export function AppSidebar({
  page,
  onPageChange,
  isCompactCourseSidebar,
  onToggleCompactCourseSidebar,
  isCompactAnalysisSidebar,
  onToggleCompactAnalysisSidebar,
  courses,
  activeCourseId,
  activeLineId,
  progress,
  onSelectLesson,
  analysisSections,
  activeAnalysisSection,
  onSelectAnalysisSection
}: AppSidebarProps) {
  const [favoriteLineIds, setFavoriteLineIds] = useState<Record<string, true>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const activeCourse = useMemo(() => courses.find((course) => course.id === activeCourseId) ?? courses[0], [activeCourseId, courses]);
  const groupedLines = useMemo(() => getGroupedLines(activeCourse, activeCourse), [activeCourse]);
  const completedCount = activeCourse.lines.filter((line) => getLessonProgress(line, progress) === 100).length;
  const courseProgress = activeCourse.lines.length ? Math.round((completedCount / activeCourse.lines.length) * 100) : 0;
  const homeButtonClass = [
    "rounded-md border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.05]",
    isCompactCourseSidebar || isCompactAnalysisSidebar ? "px-2 py-2" : "px-3 py-2.5"
  ].join(" ");

  useEffect(() => {
    setFavoriteLineIds(loadFavoriteLineIds());
  }, []);

  useEffect(() => {
    if (page !== "course") {
      return;
    }

    setCollapsedGroups((current) => {
      const next = { ...current };

      for (const group of groupedLines) {
        const groupKey = createGroupKey(activeCourse.id, group.title);

        if (!(groupKey in next)) {
          next[groupKey] = true;
        }
      }

      return next;
    });
  }, [activeCourse.id, groupedLines, page]);

  function toggleFavorite(lineId: string) {
    setFavoriteLineIds((current) => {
      const next = { ...current };

      if (next[lineId]) {
        delete next[lineId];
      } else {
        next[lineId] = true;
      }

      saveFavoriteLineIds(next);
      return next;
    });
  }

  function toggleGroup(groupTitle: string) {
    const groupKey = createGroupKey(activeCourse.id, groupTitle);

    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey]
    }));
  }

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur transition-all duration-200",
        page === "course"
          ? isCompactCourseSidebar
            ? "w-[132px]"
            : "w-[360px]"
          : page === "analysis"
            ? isCompactAnalysisSidebar
              ? "w-[132px]"
              : "w-[360px]"
            : "w-[360px]"
      ].join(" ")}
    >
      {page === "analysis" || page === "course" ? null : (
        <div className="border-b border-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Blounderproof</p>
          <div className="mt-4 grid grid-cols-6 gap-2">
            <NavButton isActive={page === "courses"} onClick={() => onPageChange("courses")}>
              Courses
            </NavButton>
            <NavButton isActive={false} onClick={() => onPageChange("analysis")}>
              Analysis
            </NavButton>
            <NavButton isActive={page === "create"} onClick={() => onPageChange("create")}>
              Create
            </NavButton>
            <NavButton isActive={page === "community"} onClick={() => onPageChange("community")}>
              Community
            </NavButton>
            <NavButton isActive={page === "leaderboard"} onClick={() => onPageChange("leaderboard")}>
              Leaders
            </NavButton>
            <NavButton isActive={page === "affiliates"} onClick={() => onPageChange("affiliates")}>
              Affiliates
            </NavButton>
          </div>
        </div>
      )}

      {page === "course" ? (
        <>
          <div className="border-b border-white/10 p-5">
            <div className={["flex gap-2", isCompactCourseSidebar ? "flex-col" : "items-center justify-between"].join(" ")}>
              <button
                type="button"
                onClick={() => onPageChange("courses")}
                className={homeButtonClass}
                aria-label="Go to home"
              >
                {isCompactCourseSidebar ? (
                  <img src="/blounderproof-logo.png" alt="Blounderproof" className="h-10 w-10 rounded-md object-cover" />
                ) : (
                  <div className="flex items-center gap-3 text-left">
                    <img src="/blounderproof-logo.png" alt="Blounderproof" className="h-12 w-12 rounded-lg object-cover shadow-[0_8px_24px_rgba(0,0,0,0.2)]" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">BLUNDERPROOF</p>
                      <p className="mt-1 text-xs text-zinc-400">Home</p>
                    </div>
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={onToggleCompactCourseSidebar}
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300 transition hover:bg-white/[0.05]"
              >
                {isCompactCourseSidebar ? "Expand" : "Compact"}
              </button>
            </div>
            {isCompactCourseSidebar ? null : (
              <>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Selected course</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{activeCourse.name}</h2>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                  <span>
                    {completedCount}/{activeCourse.lines.length} completed
                  </span>
                  <span>{courseProgress}% learned</span>
                </div>
              </>
            )}
            {isCompactCourseSidebar ? null : <ProgressIndicator value={courseProgress} />}
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-3">
            {groupedLines.length ? (
              <div className="space-y-3">
                {groupedLines.map((group) => (
                  <div key={group.title}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1 text-left transition hover:bg-white/[0.04]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded border border-white/10 text-[10px] text-zinc-400">
                          {collapsedGroups[createGroupKey(activeCourse.id, group.title)] ? "+" : "-"}
                        </span>
                        {isCompactCourseSidebar ? null : <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{group.title}</span>}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-zinc-600">{group.items.length}</span>
                    </button>
                    {collapsedGroups[createGroupKey(activeCourse.id, group.title)] ? null : (
                      <div className="space-y-1">
                        {group.items.map(({ line, index }) => (
                          <LessonItem
                            key={line.id}
                            line={line}
                            index={index}
                            isActive={line.id === activeLineId}
                            progress={getLessonProgress(line, progress)}
                            trainerProgress={progress}
                            isDue={isLineDue(line, progress)}
                            isFavorite={Boolean(favoriteLineIds[line.id])}
                            onSelect={() => onSelectLesson(activeCourse.id, index)}
                            onToggleFavorite={() => toggleFavorite(line.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-zinc-400">
                No lines match that filter yet.
              </div>
            )}
          </nav>
        </>
      ) : page === "courses" ? (
        <nav className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Course library</p>
            <h2 className="mt-2 text-lg font-semibold text-white">Browse your courses</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">Pick a course from the main page to jump into the dedicated board view with all of its lines here in the sidebar.</p>
          </div>
          <div className="mt-4 space-y-2">
            {courses.map((course) => {
              const isActiveCourse = course.id === activeCourseId;
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onSelectLesson(course.id, 0)}
                  className={[
                    "w-full rounded-md border px-3 py-3 text-left transition",
                    isActiveCourse
                      ? "border-emerald-300/35 bg-emerald-300/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold">{course.name}</span>
                    <span className="rounded-full bg-black/25 px-2 py-1 text-[11px] capitalize text-zinc-400">{course.repertoire}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{course.description}</p>
                </button>
              );
            })}
          </div>
        </nav>
      ) : (
        <nav className="min-h-0 flex-1 overflow-y-auto p-4">
          <div>
            <button
              type="button"
              onClick={() => onPageChange("courses")}
              className={homeButtonClass}
              aria-label="Go to home"
            >
              {isCompactAnalysisSidebar ? (
                <img src="/blounderproof-logo.png" alt="Blounderproof" className="h-10 w-10 rounded-md object-cover" />
              ) : (
                <div className="flex items-center gap-3 text-left">
                  <img src="/blounderproof-logo.png" alt="Blounderproof" className="h-12 w-12 rounded-lg object-cover shadow-[0_8px_24px_rgba(0,0,0,0.2)]" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">BLUNDERPROOF</p>
                    <p className="mt-1 text-xs text-zinc-400">Home</p>
                  </div>
                </div>
              )}
            </button>
          </div>
          {isCompactAnalysisSidebar ? null : (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Analysis workspace</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Game review</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">Jump between the report sections while you review strengths, weaknesses, and practical next steps.</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {analysisSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelectAnalysisSection(section.id)}
                className={[
                  "flex w-full items-center justify-between rounded-md border px-3 py-3 text-left text-sm font-medium transition",
                  activeAnalysisSection === section.id
                    ? "border-emerald-300/35 bg-emerald-300/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
                ].join(" ")}
              >
                <span>{isCompactAnalysisSidebar ? section.label.slice(0, 3) : section.label}</span>
                {isCompactAnalysisSidebar ? null : <span className="text-xs uppercase tracking-wide text-zinc-500">Go</span>}
              </button>
            ))}
          </div>
        </nav>
      )}
    </aside>
  );
}

function NavButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-3 py-2 text-sm font-semibold transition",
        isActive ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.05]"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

type LessonItemProps = {
  line: TrainingLine;
  index: number;
  isActive: boolean;
  progress: number;
  trainerProgress: TrainerProgress;
  isDue: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
};

function LessonItem({ line, index, isActive, progress, trainerProgress, isDue, isFavorite, onSelect, onToggleFavorite }: LessonItemProps) {
  const isComplete = progress === 100;
  const lineStatus = getLineStatus(line, trainerProgress);

  return (
    <div className={["rounded-md transition", isActive ? "bg-emerald-300/12 ring-1 ring-emerald-300/35" : "hover:bg-white/[0.05]"].join(" ")}>
      <div className="flex w-full items-center gap-2 rounded-md px-2 py-2">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span
            className={[
              "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
              isComplete ? "border-emerald-300/50 bg-emerald-300 text-zinc-950" : isActive ? "border-emerald-300/50 text-emerald-200" : "border-white/10 text-zinc-500"
            ].join(" ")}
          >
            {isComplete ? "OK" : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={["block min-w-0 flex-1 truncate text-sm font-medium", isActive ? "text-white" : "text-zinc-300"].join(" ")}>{line.name}</span>
              <span className={getStatusClasses(lineStatus)}>{lineStatus}</span>
            </span>
            <span className="mt-1 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full bg-emerald-300" style={{ width: `${progress}%` }} />
              </span>
              <span className="w-9 text-right text-[11px] text-zinc-500">{progress}%</span>
            </span>
          </span>
          {isDue ? <span className="shrink-0 rounded-full bg-amber-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Due</span> : null}
        </button>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Remove bookmark" : "Add bookmark"}
          className={[
            "grid h-8 w-8 shrink-0 place-items-center rounded-md border text-sm transition",
            isFavorite ? "border-amber-300/35 bg-amber-300/10 text-amber-200" : "border-white/10 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
          ].join(" ")}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}

function ProgressIndicator({ value }: { value: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function getLessonProgress(line: TrainingLine, progress: TrainerProgress): number {
  const lineProgress = progress.lines[line.id];

  if (!lineProgress?.lastReviewedAt) {
    return 0;
  }

  if (lineProgress.intervalDays > 0 && lineProgress.streak > 0) {
    return 100;
  }

  return Math.min(95, Math.max(20, Math.round((lineProgress.correct / Math.max(1, line.moves.length)) * 100)));
}

function getStatusClasses(status: ReturnType<typeof getLineStatus>): string {
  const base = "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide";

  switch (status) {
    case "mastered":
      return `${base} bg-emerald-300/15 text-emerald-200`;
    case "solid":
      return `${base} bg-sky-300/15 text-sky-200`;
    case "shaky":
      return `${base} bg-rose-300/15 text-rose-200`;
    case "learning":
      return `${base} bg-amber-300/15 text-amber-200`;
    default:
      return `${base} bg-white/10 text-zinc-300`;
  }
}

type GroupedLines = {
  title: string;
  items: Array<{
    line: TrainingLine;
    index: number;
  }>;
};

function getGroupedLines(course: OpeningCourse, sourceCourse: OpeningCourse): GroupedLines[] {
  const groups = new Map<string, GroupedLines["items"]>();

  course.lines.forEach((line) => {
    const title = line.section ?? inferSectionTitle(course, line);
    const items = groups.get(title) ?? [];
    items.push({ line, index: Math.max(0, sourceCourse.lines.findIndex((candidate) => candidate.id === line.id)) });
    groups.set(title, items);
  });

  return Array.from(groups.entries())
    .map(([title, items]) => ({ title, items }))
    .sort((a, b) => getSectionOrder(a.title) - getSectionOrder(b.title) || a.title.localeCompare(b.title));
}

function inferSectionTitle(course: OpeningCourse, line: TrainingLine): string {
  const courseText = `${course.name} ${course.description}`.toLowerCase();
  const lineName = line.name.toLowerCase();

  if (/endgame|mate|lucena|philidor|opposition|pawn/.test(courseText)) {
    if (/draw|philidor|wrong-color|rook pawn/.test(lineName)) {
      return "Defensive Draws";
    }

    if (/mate|box|staircase|ladder|lucena|queen vs knight|shuffle/.test(lineName)) {
      return "Technique";
    }

    return "Core";
  }

  if (/trap|mate pattern|give the pawn|punish/.test(lineName)) {
    return "Traps";
  }

  if (/vs |variation|sideline|g6|bb4|ne4|panov|exchange|advance/.test(lineName)) {
    return "Sidelines";
  }

  return "Main Lines";
}

function getSectionOrder(title: string): number {
  switch (title) {
    case "Main Lines":
      return 0;
    case "Traps":
      return 1;
    case "Sidelines":
      return 2;
    case "Core":
      return 3;
    case "Technique":
      return 4;
    case "Defensive Draws":
      return 5;
    default:
      return 10;
  }
}

function loadFavoriteLineIds(): Record<string, true> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(favoriteLinesStorageKey);
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveFavoriteLineIds(value: Record<string, true>): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(favoriteLinesStorageKey, JSON.stringify(value));
}

function createGroupKey(courseId: string, groupTitle: string): string {
  return `${courseId}:${groupTitle}`;
}
