"use client";

import { useState } from "react";
import { buildTrainingJsonFromPgnStudy } from "@/lib/courseGeneration";
import type { OpeningCourse } from "@/lib/courses";
import { buildCourseFromPgn } from "@/lib/pgn";
import type { PieceColor } from "@/types/chess";

type PgnImporterProps = {
  onImportCourse: (course: OpeningCourse) => void;
};

export function PgnImporter({ onImportCourse }: PgnImporterProps) {
  const [courseName, setCourseName] = useState("My PGN Repertoire");
  const [pgn, setPgn] = useState("");
  const [sideToTrain, setSideToTrain] = useState<PieceColor>("white");
  const [includeVariations, setIncludeVariations] = useState(false);
  const [maxLines, setMaxLines] = useState(12);
  const [error, setError] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [previewCourse, setPreviewCourse] = useState<OpeningCourse | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Record<string, boolean>>({});

  function handleAnalyze() {
    setError("");
    setImportSummary("");
    setPreviewCourse(null);
    setSelectedLineIds({});

    const generated = buildTrainingJsonFromPgnStudy(pgn, {
      courseId: `imported-study-${Date.now()}`,
      courseName: courseName.trim() || "Imported PGN Study",
      repertoire: sideToTrain,
      includeVariations,
      maxLines: Math.max(1, Math.min(40, maxLines))
    });

    if (generated.course.lines.length > 0) {
      setPreviewCourse(generated.course);
      setSelectedLineIds(Object.fromEntries(generated.course.lines.map((line) => [line.id, true])));
      setImportSummary(`Found ${generated.rankedCandidates.length} candidate lines. Previewing top ${generated.course.lines.length}.`);
      return;
    }

    const course = buildCourseFromPgn({ pgn, courseName, sideToTrain });

    if (!course) {
      setError("Paste a clean PGN line or PGN study with at least a few moves.");
      return;
    }

    setPreviewCourse(course);
    setSelectedLineIds(Object.fromEntries(course.lines.map((line) => [line.id, true])));
    setImportSummary("Previewing one clean PGN line.");
  }

  function handleImportSelected() {
    if (!previewCourse) {
      setError("Analyze a PGN before importing.");
      return;
    }

    const selectedLines = previewCourse.lines.filter((line) => selectedLineIds[line.id]);

    if (selectedLines.length === 0) {
      setError("Select at least one line to import.");
      return;
    }

    onImportCourse({
      ...previewCourse,
      lines: selectedLines
    });
    setImportSummary(`Imported ${selectedLines.length} selected line${selectedLines.length === 1 ? "" : "s"}.`);
  }

  function toggleLine(lineId: string) {
    setSelectedLineIds((current) => ({
      ...current,
      [lineId]: !current[lineId]
    }));
  }

  const selectedCount = previewCourse?.lines.filter((line) => selectedLineIds[line.id]).length ?? 0;

  return (
    <section className="rounded-lg border border-white/10 bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">PGN import</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Build a quick course</h2>
        </div>
        <div className="flex rounded-md border border-white/10 bg-black/20 p-1">
          {(["white", "black"] as PieceColor[]).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setSideToTrain(side)}
              className={[
                "rounded px-3 py-1 text-sm font-medium capitalize transition",
                sideToTrain === side ? "bg-emerald-300 text-zinc-950" : "text-zinc-300 hover:bg-white/[0.06]"
              ].join(" ")}
            >
              {side}
            </button>
          ))}
        </div>
      </div>

      <input
        className="mt-4 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/50"
        placeholder="Course name"
        value={courseName}
        onChange={(event) => setCourseName(event.target.value)}
      />
      <textarea
        className="mt-3 min-h-28 w-full resize-y rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/50"
        placeholder="Paste a clean line or full PGN study"
        value={pgn}
        onChange={(event) => setPgn(event.target.value)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={includeVariations}
            onChange={(event) => setIncludeVariations(event.target.checked)}
            className="h-4 w-4 accent-emerald-300"
          />
          Include PGN variations
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          Max lines
          <input
            type="number"
            min={1}
            max={40}
            value={maxLines}
            onChange={(event) => setMaxLines(Number(event.target.value))}
            className="w-20 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-white outline-none focus:border-emerald-300/50"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-zinc-500">Analyze a clean opening line or full PGN study, preview the best lines, then import only what you want.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleAnalyze} className="rounded-md bg-emerald-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200">
            Analyze PGN
          </button>
          <button
            type="button"
            onClick={handleImportSelected}
            disabled={!previewCourse}
            className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Import selected
          </button>
        </div>
      </div>

      {previewCourse ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Generated lines preview</h3>
            <span className="text-xs text-zinc-400">
              {selectedCount}/{previewCourse.lines.length} selected
            </span>
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {previewCourse.lines.map((line, index) => (
              <label key={line.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]">
                <input type="checkbox" checked={Boolean(selectedLineIds[line.id])} onChange={() => toggleLine(line.id)} className="mt-1 h-4 w-4 accent-emerald-300" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {index + 1}. {line.name}
                    </span>
                    <span className="shrink-0 text-xs text-emerald-200">{line.moves.length} moves</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-zinc-500">{line.moves.map((move) => move.san).join(" ")}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {importSummary ? <p className="mt-2 text-xs text-emerald-200">{importSummary}</p> : null}
    </section>
  );
}
