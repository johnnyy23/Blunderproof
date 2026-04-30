import type { OpeningCourse, TrainingLine, TrainingMove } from "@/lib/courses";
import { createLineCandidateId, rankLineCandidates, type RankedLineCandidate } from "@/lib/lineRanking";
import { parseSanLine, type ParsedSanMove } from "@/lib/pgn";
import { extractStudyLinesFromPgn, groupDuplicateStudyLines } from "@/lib/studyExtraction";
import type { PieceColor } from "@/types/chess";

export type GeneratedCourseOptions = {
  courseId: string;
  courseName: string;
  repertoire: PieceColor;
  level?: string;
  description?: string;
  maxLines?: number;
  includeVariations?: boolean;
};

export type GeneratedTrainingJson = {
  course: OpeningCourse;
  rankedCandidates: RankedLineCandidate[];
};

export function buildTrainingJsonFromSanLines(
  rawLines: Array<{ name: string; sanMoves: string[]; sourceTitle?: string; frequency?: number }>,
  options: GeneratedCourseOptions
): GeneratedTrainingJson {
  const rankedCandidates = rankLineCandidates(
    rawLines.map((line, index) => ({
      id: createLineCandidateId(line.name, index),
      name: line.name,
      sanMoves: line.sanMoves,
      sourceTitle: line.sourceTitle,
      frequency: line.frequency ?? 1
    }))
  );

  const selected = rankedCandidates.slice(0, options.maxLines ?? 12);

  const course: OpeningCourse = {
    id: options.courseId,
    name: options.courseName,
    repertoire: options.repertoire,
    level: options.level ?? "Beginner-1600",
    description: options.description ?? "Generated from PGN study lines and curated for practical opening training.",
    lines: selected.map((candidate) => createTrainingLine(candidate, options.repertoire))
  };

  return {
    course,
    rankedCandidates
  };
}

export function buildTrainingJsonFromPgnStudy(pgn: string, options: GeneratedCourseOptions): GeneratedTrainingJson {
  const extractedLines = groupDuplicateStudyLines(extractStudyLinesFromPgn(pgn, { includeVariations: options.includeVariations }));

  return buildTrainingJsonFromSanLines(
    extractedLines.map((line) => ({
      name: line.name,
      sanMoves: line.sanMoves,
      sourceTitle: line.sourceTitle,
      frequency: line.frequency
    })),
    options
  );
}

function createTrainingLine(candidate: RankedLineCandidate, sideToTrain: PieceColor): TrainingLine {
  const parsed = parseSanLine(candidate.sanMoves);
  const startIndex = sideToTrain === "white" ? 0 : 1;
  const fen = sideToTrain === "white" ? parsed.positions[0]?.fen : parsed.positions[1]?.fen;

  return {
    id: candidate.id,
    name: candidate.name,
    analysisTags: buildAnalysisTags(candidate.name, candidate.sanMoves),
    fen: fen ?? "startpos",
    sideToTrain,
    dueLevel: "new",
    moves: buildTrainingMoves(parsed.moves, startIndex, candidate, sideToTrain)
  };
}

function buildTrainingMoves(parsedMoves: ParsedSanMove[], startIndex: number, candidate: RankedLineCandidate, sideToTrain: PieceColor): TrainingMove[] {
  const moves: TrainingMove[] = [];

  for (let index = startIndex; index < parsedMoves.length; index += 2) {
    const move = parsedMoves[index];
    const reply = parsedMoves[index + 1];

    if (!move) {
      continue;
    }

    moves.push({
      uci: move.uci,
      san: sideToTrain === "black" ? `...${move.san}` : move.san,
      prompt: `Find move ${moves.length + 1} in ${candidate.name}.`,
      explanation: `This move comes from a high-priority PGN line. Ranking notes: ${candidate.reasons.join(", ") || "practical repertoire line"}.`,
      plan: "Learn the move first, then connect it to the plan: develop cleanly, avoid common traps, and reach a playable middlegame.",
      opponentReply: reply
        ? {
            uci: reply.uci,
            san: sideToTrain === "white" ? `...${reply.san}` : reply.san
          }
        : undefined
    });
  }

  return moves;
}

function buildAnalysisTags(name: string, sanMoves: string[]): string[] {
  const tags = new Set<string>();
  const normalizedName = name.trim().toLowerCase();

  if (normalizedName) {
    tags.add(normalizedName);
  }

  const firstMoves = sanMoves.slice(0, 8);

  if (firstMoves.length) {
    tags.add(firstMoves.join(" ").toLowerCase());
  }

  for (const move of firstMoves) {
    const cleaned = move.toLowerCase().replace(/[!?+#]/g, "").trim();

    if (cleaned) {
      tags.add(cleaned);
    }
  }

  return Array.from(tags);
}
