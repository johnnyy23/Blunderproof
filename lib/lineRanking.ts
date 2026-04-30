export type RankedLineCandidate = {
  id: string;
  name: string;
  sanMoves: string[];
  sourceTitle?: string;
  frequency: number;
  score: number;
  reasons: string[];
};

const forcingMovePattern = /[+#x]/;
const trapPattern = /(mate|wins|trap|blunder|loses|fork|pin|sac|sacrifice|poisoned|tactic)/i;

export function rankLineCandidates(candidates: Omit<RankedLineCandidate, "score" | "reasons">[]): RankedLineCandidate[] {
  return candidates
    .map((candidate) => {
      const reasons: string[] = [];
      let score = 0;

      score += Math.min(candidate.frequency * 4, 24);

      const forcingMoves = candidate.sanMoves.filter((move) => forcingMovePattern.test(move)).length;
      if (forcingMoves > 0) {
        score += forcingMoves * 3;
        reasons.push(`${forcingMoves} forcing move${forcingMoves === 1 ? "" : "s"}`);
      }

      const hasTrapLanguage = trapPattern.test(`${candidate.name} ${candidate.sourceTitle ?? ""}`);
      if (hasTrapLanguage) {
        score += 18;
        reasons.push("trap or tactic theme");
      }

      if (candidate.sanMoves.length >= 8 && candidate.sanMoves.length <= 18) {
        score += 10;
        reasons.push("good trainer length");
      }

      if (candidate.sanMoves.length > 24) {
        score -= 12;
        reasons.push("long theory branch");
      }

      return {
        ...candidate,
        score,
        reasons
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function createLineCandidateId(name: string, index: number): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `${slug || "line"}-${index + 1}`;
}
