import { tokenizePgn } from "@/lib/pgn";

export type ExtractedStudyLine = {
  name: string;
  sourceTitle?: string;
  sanMoves: string[];
  frequency: number;
};

export type StudyExtractionOptions = {
  includeVariations?: boolean;
};

const chapterNamePattern = /\[ChapterName\s+"([^"]+)"\]/;
const eventPattern = /\[Event\s+"([^"]+)"\]/;

export function extractStudyLinesFromPgn(pgn: string, options: StudyExtractionOptions = {}): ExtractedStudyLine[] {
  const chapters = splitPgnIntoGames(pgn);

  return chapters
    .flatMap((chapter, index) => {
      const chapterName = readHeader(chapter, chapterNamePattern);
      const eventName = readHeader(chapter, eventPattern);
      const name = chapterName || eventName || `PGN line ${index + 1}`;

      const lines: ExtractedStudyLine[] = [
        {
          name,
          sourceTitle: eventName,
          sanMoves: tokenizePgn(chapter),
          frequency: 1
        }
      ];

      if (options.includeVariations) {
        lines.push(...extractVariationLines(chapter, name, eventName));
      }

      return lines;
    })
    .filter((line) => line.sanMoves.length > 0);
}

export function groupDuplicateStudyLines(lines: ExtractedStudyLine[]): ExtractedStudyLine[] {
  const grouped = new Map<string, ExtractedStudyLine>();

  for (const line of lines) {
    const key = line.sanMoves.join(" ");
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...line });
      continue;
    }

    grouped.set(key, {
      ...existing,
      frequency: existing.frequency + line.frequency
    });
  }

  return Array.from(grouped.values());
}

function splitPgnIntoGames(pgn: string): string[] {
  return pgn
    .split(/\n\s*\n(?=\[Event\s+")/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function extractVariationLines(chapter: string, parentName: string, eventName?: string): ExtractedStudyLine[] {
  return collectTopLevelVariations(chapter)
    .map((variation, index) => ({
      name: `${parentName} Variation ${index + 1}`,
      sourceTitle: eventName,
      sanMoves: tokenizePgn(variation),
      frequency: 1
    }))
    .filter((line) => line.sanMoves.length > 0);
}

function collectTopLevelVariations(pgn: string): string[] {
  const variations: string[] = [];
  let depth = 0;
  let startIndex = -1;

  for (let index = 0; index < pgn.length; index += 1) {
    const char = pgn[index];

    if (char === "(") {
      if (depth === 0) {
        startIndex = index + 1;
      }

      depth += 1;
      continue;
    }

    if (char === ")") {
      depth -= 1;

      if (depth === 0 && startIndex >= 0) {
        variations.push(pgn.slice(startIndex, index));
        startIndex = -1;
      }
    }
  }

  return variations;
}

function readHeader(pgn: string, pattern: RegExp): string | undefined {
  return pgn.match(pattern)?.[1];
}
