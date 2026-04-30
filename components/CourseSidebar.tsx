"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpeningCourse, TrainingLine } from "@/lib/courses";
import type { TrainerProgress } from "@/lib/trainer";
import { getLineStatus, isLineDue } from "@/lib/trainer";

const expandedStorageKey = "blounderproof:expanded-sections:v1";
const favoriteLinesStorageKey = "blounderproof:favorite-lines:v1";
type CourseLibraryView = "all" | "openings" | "endgames";

type CourseSidebarProps = {
  courses: OpeningCourse[];
  activeCourseId: string;
  activeLineId: string;
  progress: TrainerProgress;
  onSelectLesson: (courseId: string, lineIndex: number) => void;
};

export function CourseSidebar({ courses, activeCourseId, activeLineId, progress, onSelectLesson }: CourseSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteLineIds, setFavoriteLineIds] = useState<Record<string, true>>({});
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [libraryView, setLibraryView] = useState<CourseLibraryView>("all");

  useEffect(() => {
    setExpandedSections(loadExpandedSections());
    setFavoriteLineIds(loadFavoriteLineIds());
  }, []);

  useEffect(() => {
    setExpandedSections((current) => {
      const next = { ...current, [activeCourseId]: true };
      saveExpandedSections(next);
      return next;
    });
  }, [activeCourseId]);

  function toggleSection(courseId: string) {
    setExpandedSections((current) => {
      const next = { ...current, [courseId]: !current[courseId] };
      saveExpandedSections(next);
      return next;
    });
  }

  const totalLessons = useMemo(() => courses.reduce((total, course) => total + course.lines.length, 0), [courses]);
  const completedLessons = useMemo(
    () => courses.reduce((total, course) => total + course.lines.filter((line) => getLessonProgress(line, progress) === 100).length, 0),
    [courses, progress]
  );
  const filteredCourses = useMemo(
    () => filterCourses(courses, searchQuery, favoriteLineIds, favoritesOnly, libraryView),
    [courses, searchQuery, favoriteLineIds, favoritesOnly, libraryView]
  );

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

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[360px] flex-col border-r border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur">
      <div className="border-b border-white/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Blounderproof</p>
        <h1 className="mt-2 text-xl font-semibold text-white">Opening training</h1>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Library progress</span>
            <span>
              {completedLessons}/{totalLessons}
            </span>
          </div>
          <ProgressIndicator value={totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0} />
        </div>
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "all", label: "All" },
              { value: "openings", label: "Openings" },
              { value: "endgames", label: "Endgames" }
            ] as Array<{ value: CourseLibraryView; label: string }>).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setLibraryView(option.value)}
                className={[
                  "rounded-md border px-2 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                  libraryView === option.value
                    ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.05]"
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label htmlFor="course-search" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Search courses and lines
          </label>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
            <input
              id="course-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Jobava, Lucena, Panov..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((current) => !current)}
            className={[
              "w-full rounded-md border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] transition",
              favoritesOnly
                ? "border-amber-300/35 bg-amber-300/10 text-amber-100"
                : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.05]"
            ].join(" ")}
          >
            {favoritesOnly ? "Showing favorites only" : "Show favorites only"}
          </button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {filteredCourses.length ? (
            filteredCourses.map((course) => (
              <SidebarSection
                key={course.id}
                course={course}
                isExpanded={searchQuery.trim() ? true : Boolean(expandedSections[course.id])}
                activeLineId={activeLineId}
                progress={progress}
                favoriteLineIds={favoriteLineIds}
                onToggle={() => toggleSection(course.id)}
                onSelectLesson={(lineIndex) => onSelectLesson(course.id, lineIndex)}
                onToggleFavorite={toggleFavorite}
              />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-zinc-400">
              No courses or lines match that search yet.
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}

type SidebarSectionProps = {
  course: OpeningCourse;
  isExpanded: boolean;
  activeLineId: string;
  progress: TrainerProgress;
  favoriteLineIds: Record<string, true>;
  onToggle: () => void;
  onSelectLesson: (lineIndex: number) => void;
  onToggleFavorite: (lineId: string) => void;
};

function SidebarSection({ course, isExpanded, activeLineId, progress, favoriteLineIds, onToggle, onSelectLesson, onToggleFavorite }: SidebarSectionProps) {
  const completedCount = course.lines.filter((line) => getLessonProgress(line, progress) === 100).length;
  const courseProgress = course.lines.length ? Math.round((completedCount / course.lines.length) * 100) : 0;
  const lineCountLabel = `${course.lines.length} ${course.lines.length === 1 ? "line" : "lines"}`;
  const groupedLines = getGroupedLines(course);

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left transition hover:bg-white/[0.04]">
        <span className="mt-0.5 grid h-5 w-5 place-items-center rounded border border-white/10 text-xs text-zinc-300">{isExpanded ? "-" : "+"}</span>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-emerald-300/25 bg-emerald-300/12 text-center">
          <span>
            <span className="block text-base font-bold leading-none text-emerald-100">{course.lines.length}</span>
            <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-emerald-300/80">lines</span>
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="truncate font-semibold text-white">{course.name}</span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-full bg-black/25 px-2 py-1 text-[11px] capitalize text-zinc-300">{course.repertoire}</span>
            </span>
          </span>
          <span className="mt-1 flex items-center justify-between gap-3 text-xs font-semibold text-emerald-100">
            <span>{lineCountLabel} in this course</span>
            <span>{courseProgress}% learned</span>
          </span>
          <span className="mt-1 flex items-center justify-between gap-3 text-xs leading-5 text-zinc-500">
            <span>{course.level}</span>
            <span className="shrink-0">{completedCount}/{course.lines.length} complete</span>
          </span>
          <ProgressIndicator value={courseProgress} />
        </span>
      </button>

      {isExpanded ? (
        <div className="border-t border-white/10 px-2 py-2">
          <div className="space-y-3">
            {groupedLines.map((group) => (
              <div key={group.title}>
                <div className="mb-2 flex items-center justify-between px-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{group.title}</span>
                  <span className="text-[10px] uppercase tracking-wide text-zinc-600">{group.items.length}</span>
                </div>
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
                      onSelect={() => onSelectLesson(index)}
                      onToggleFavorite={() => onToggleFavorite(line.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
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
  const previewMoves = [...(line.prelude ?? []).map((move) => move.san), ...line.moves.slice(0, 3).map((move) => move.san)].join(" ");
  const lineStatus = getLineStatus(line, trainerProgress);

  return (
    <div
      className={[
        "rounded-md transition",
        isActive ? "bg-emerald-300/12 ring-1 ring-emerald-300/35" : "hover:bg-white/[0.05]"
      ].join(" ")}
    >
      <div className="group flex w-full items-center gap-2 rounded-md px-2 py-2">
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className={[
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
            isComplete ? "border-emerald-300/50 bg-emerald-300 text-zinc-950" : isActive ? "border-emerald-300/50 text-emerald-200" : "border-white/10 text-zinc-500"
          ].join(" ")}
        >
          {isComplete ? "✓" : index + 1}
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
            isFavorite
              ? "border-amber-300/35 bg-amber-300/10 text-amber-200"
              : "border-white/10 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
          ].join(" ")}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>

      {isActive ? (
        <div className="border-t border-white/10 px-3 pb-3 pt-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <span className="rounded-full border border-white/10 px-2 py-1 capitalize text-zinc-300">{line.sideToTrain}</span>
            <span>{line.moves.length} moves</span>
          </div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{previewMoves}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-300">{summarizePrompt(line.moves[0]?.prompt ?? "")}</p>
        </div>
      ) : null}
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

function loadExpandedSections(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(expandedStorageKey);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveExpandedSections(value: Record<string, boolean>): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(expandedStorageKey, JSON.stringify(value));
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

function summarizePrompt(prompt: string): string {
  if (!prompt) {
    return "A practical training line for this course.";
  }

  const trimmed = prompt.trim();
  return trimmed.endsWith("?") ? trimmed.slice(0, -1) : trimmed;
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

function getGroupedLines(course: OpeningCourse): GroupedLines[] {
  const groups = new Map<string, GroupedLines["items"]>();

  course.lines.forEach((line, index) => {
    const title = line.section ?? inferSectionTitle(course, line);
    const items = groups.get(title) ?? [];
    items.push({ line, index });
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

function filterCourses(
  courses: OpeningCourse[],
  query: string,
  favoriteLineIds: Record<string, true>,
  favoritesOnly: boolean,
  libraryView: CourseLibraryView
): OpeningCourse[] {
  const normalizedQuery = query.trim().toLowerCase();
  const scopedCourses = courses.filter((course) => matchesLibraryView(course, libraryView));

  if (!normalizedQuery && !favoritesOnly) {
    return scopedCourses;
  }

  return scopedCourses
    .map((course) => {
      const favoriteFilteredLines = favoritesOnly ? course.lines.filter((line) => favoriteLineIds[line.id]) : course.lines;

      if (!favoriteFilteredLines.length) {
        return null;
      }

      const courseMatches = [course.name, course.description, course.level, course.repertoire].some((value) =>
        value.toLowerCase().includes(normalizedQuery)
      );

      if (!normalizedQuery) {
        return {
          ...course,
          lines: favoriteFilteredLines
        };
      }

      if (courseMatches) {
        return {
          ...course,
          lines: favoriteFilteredLines
        };
      }

      const matchingLines = favoriteFilteredLines.filter((line) => matchesLineSearch(line, normalizedQuery));

      if (!matchingLines.length) {
        return null;
      }

      return {
        ...course,
        lines: matchingLines
      };
    })
    .filter((course): course is OpeningCourse => course !== null);
}

function matchesLibraryView(course: OpeningCourse, libraryView: CourseLibraryView): boolean {
  if (libraryView === "all") {
    return true;
  }

  const category = inferCourseCategory(course);
  return libraryView === category;
}

function inferCourseCategory(course: OpeningCourse): Exclude<CourseLibraryView, "all"> {
  const courseText = `${course.name} ${course.description}`.toLowerCase();
  return /endgame|mate|lucena|philidor|opposition|pawn/.test(courseText) ? "endgames" : "openings";
}

function matchesLineSearch(line: TrainingLine, query: string): boolean {
  const previewMoves = [...(line.prelude ?? []).map((move) => move.san), ...line.moves.slice(0, 4).map((move) => move.san)].join(" ");
  const searchableParts = [
    line.name,
    line.section ?? "",
    line.sideToTrain,
    previewMoves,
    line.moves[0]?.prompt ?? "",
    line.moves[0]?.plan ?? ""
  ];

  return searchableParts.some((value) => value.toLowerCase().includes(query));
}
