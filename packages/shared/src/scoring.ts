export interface ScoreInput {
  isCorrect: boolean;
  points: number;
  /** Server-measured time from question broadcast to answer receipt. */
  latencyMs: number;
  /** null = no time limit; speed weighting then falls back to fixed points. */
  timeLimitMs: number | null;
  speedScoring: boolean;
}

/**
 * Fixed: full points for a correct answer.
 * Speed-weighted: points × (1 − (t / limit) / 2), so the slowest correct answer still earns half.
 */
export function scoreAnswer(i: ScoreInput): number {
  if (!i.isCorrect) return 0;
  if (!i.speedScoring || i.timeLimitMs === null || i.timeLimitMs <= 0) return i.points;
  const t = Math.min(Math.max(i.latencyMs, 0), i.timeLimitMs);
  return Math.round(i.points * (1 - t / i.timeLimitMs / 2));
}

export interface RankInput {
  id: string;
  nickname: string;
  points: number;
  correct: number;
  /** Sum of latencies of correct answers. */
  latencyMs: number;
}

export interface Ranked<T extends RankInput> {
  row: T;
  rank: number;
}

/** Ties: more points, then more correct answers, then lower total latency; still equal = shared rank. */
export function rankPlayers<T extends RankInput>(rows: readonly T[]): Ranked<T>[] {
  const sorted = rows
    .slice()
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.correct - a.correct ||
        a.latencyMs - b.latencyMs ||
        a.nickname.localeCompare(b.nickname, 'pl'),
    );
  const out: Ranked<T>[] = [];
  sorted.forEach((row, i) => {
    const prev = out[i - 1];
    const tied =
      prev && prev.row.points === row.points && prev.row.correct === row.correct && prev.row.latencyMs === row.latencyMs;
    out.push({ row, rank: tied ? prev.rank : i + 1 });
  });
  return out;
}
