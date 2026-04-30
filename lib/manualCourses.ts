import { parseFen, startingFen } from "@/lib/chess";
import type { OpeningCourse, PreludeMove, TrainingLine, TrainingMove } from "@/lib/courses";
import type { PieceColor } from "@/types/chess";

export type RecordedLineMove = {
  uci: string;
  san: string;
};

type BuildManualCourseInput = {
  courseName: string;
  description: string;
  creatorName: string;
  sideToTrain: PieceColor;
  courseType?: "opening" | "endgame";
  lines: Array<{
    name: string;
    moves: RecordedLineMove[];
    startingFen?: string;
  }>;
  shareWithCommunity?: boolean;
};

export function buildManualCourse(input: BuildManualCourseInput): OpeningCourse {
  const creatorName = input.creatorName.trim() || "Anonymous";

  return {
    id: `manual-course-${Date.now()}`,
    name: input.courseName.trim() || "Manual Course",
    repertoire: input.sideToTrain,
    level: "Custom",
    description: input.description.trim() || "A custom course created by hand on the board.",
    createdAt: new Date().toISOString(),
    source: input.shareWithCommunity ? "community" : "manual",
    creator: {
      id: slugify(creatorName) || "anonymous",
      name: creatorName
    },
    engagement: {
      likes: 0,
      rating: 0,
      votes: 0
    },
    isShared: Boolean(input.shareWithCommunity),
    lines: input.lines.map((line, index) =>
      buildTrainingLineFromRecordedMoves(line.name, line.moves, input.sideToTrain, index, line.startingFen, input.courseType ?? "opening")
    )
  };
}

export function sortCommunityCoursesByEngagement(courses: OpeningCourse[]): OpeningCourse[] {
  return [...courses].sort((left, right) => {
    const leftScore = (left.engagement?.likes ?? 0) + (left.engagement?.rating ?? 0) * 3;
    const rightScore = (right.engagement?.likes ?? 0) + (right.engagement?.rating ?? 0) * 3;
    return rightScore - leftScore;
  });
}

function buildTrainingLineFromRecordedMoves(
  name: string,
  recordedMoves: RecordedLineMove[],
  sideToTrain: PieceColor,
  index: number,
  startingLineFen = startingFen,
  courseType: "opening" | "endgame"
): TrainingLine {
  const prelude: PreludeMove[] = [];
  const moves: TrainingMove[] = [];
  const startingTurn = parseFen(startingLineFen).turn;

  let cursor = 0;

  while (cursor < recordedMoves.length && moveSideAtIndex(cursor, startingTurn) !== sideToTrain) {
    prelude.push(recordedMoves[cursor]);
    cursor += 1;
  }

  while (cursor < recordedMoves.length) {
    const candidate = recordedMoves[cursor];

    if (moveSideAtIndex(cursor, startingTurn) !== sideToTrain) {
      cursor += 1;
      continue;
    }

    const opponentReply = recordedMoves[cursor + 1] && moveSideAtIndex(cursor + 1, startingTurn) !== sideToTrain
      ? {
          uci: recordedMoves[cursor + 1].uci,
          san: formatReplySan(recordedMoves[cursor + 1].san, sideToTrain)
        }
      : undefined;

    moves.push({
      uci: candidate.uci,
      san: formatPlayerSan(candidate.san, sideToTrain),
      prompt: `Find move ${moves.length + 1} in ${name}.`,
      explanation:
        courseType === "endgame"
          ? `${candidate.san} is part of the recorded endgame technique from this custom position.`
          : `${candidate.san} is part of the recorded line for this setup.`,
      plan:
        courseType === "endgame"
          ? "Start from the saved endgame position, keep the move order clean, and connect the line to the practical conversion or drawing idea."
          : "Build the position move by move, keep the move order clean, and connect the line to the resulting middlegame plan.",
      commonMistake:
        courseType === "endgame"
          ? "A common mistake here is remembering the final idea but forgetting the exact setup and move order that makes the endgame work."
          : "A common mistake here is mixing move orders and accidentally drifting into a different line.",
      opponentReply
    });

    cursor += opponentReply ? 2 : 1;
  }

  return {
    id: `${slugify(name) || "manual-line"}-${index + 1}`,
    name: name.trim() || `Manual line ${index + 1}`,
    section: courseType === "endgame" ? "Manual Endgames" : "Manual Lines",
    analysisTags: buildAnalysisTags(name, recordedMoves.map((move) => move.san)),
    fen: startingLineFen,
    sideToTrain,
    prelude: prelude.length ? prelude : undefined,
    moves,
    dueLevel: "new"
  };
}

function moveSideAtIndex(index: number, startingTurn: PieceColor): PieceColor {
  if (startingTurn === "white") {
    return index % 2 === 0 ? "white" : "black";
  }

  return index % 2 === 0 ? "black" : "white";
}

function formatPlayerSan(san: string, sideToTrain: PieceColor): string {
  return sideToTrain === "black" && !san.startsWith("...") ? `...${san}` : san;
}

function formatReplySan(san: string, sideToTrain: PieceColor): string {
  return sideToTrain === "white" && !san.startsWith("...") ? `...${san}` : san;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
