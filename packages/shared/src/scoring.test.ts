import { describe, expect, it } from 'vitest';
import { rankPlayers, scoreAnswer } from './scoring.ts';
import { DeckSchema } from './deck.ts';
import { normalizeNickname } from './protocol.ts';

describe('scoreAnswer', () => {
  const base = { isCorrect: true, points: 1000, latencyMs: 0, timeLimitMs: 20_000, speedScoring: false };
  it('gives fixed points for a correct answer', () => expect(scoreAnswer({ ...base, latencyMs: 19_000 })).toBe(1000));
  it('gives nothing for a wrong answer', () => expect(scoreAnswer({ ...base, isCorrect: false, speedScoring: true })).toBe(0));
  it('weights by speed: instant = full, at the limit = half', () => {
    expect(scoreAnswer({ ...base, speedScoring: true, latencyMs: 0 })).toBe(1000);
    expect(scoreAnswer({ ...base, speedScoring: true, latencyMs: 10_000 })).toBe(750);
    expect(scoreAnswer({ ...base, speedScoring: true, latencyMs: 20_000 })).toBe(500);
    expect(scoreAnswer({ ...base, speedScoring: true, latencyMs: 99_000 })).toBe(500);
  });
  it('falls back to fixed points without a time limit', () =>
    expect(scoreAnswer({ ...base, speedScoring: true, timeLimitMs: null, latencyMs: 50_000 })).toBe(1000));
});

describe('rankPlayers', () => {
  const p = (id: string, points: number, correct: number, latencyMs: number) => ({ id, nickname: id, points, correct, latencyMs });
  it('orders by points, then correct, then latency', () => {
    const r = rankPlayers([p('a', 1000, 1, 900), p('b', 2000, 2, 5000), p('c', 1000, 1, 300), p('d', 1000, 2, 9000)]);
    expect(r.map((x) => x.row.id)).toEqual(['b', 'd', 'c', 'a']);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
  });
  it('shares a rank for exact ties', () => {
    const r = rankPlayers([p('x', 0, 0, 0), p('y', 0, 0, 0), p('z', 1000, 1, 1)]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2]);
  });
});

describe('DeckSchema', () => {
  it('rejects a correct index outside the options', () => {
    const res = DeckSchema.safeParse({
      id: 'x', title: 'X',
      slides: [{ type: 'single', id: 'q1', question: 'Q?', options: ['a', 'b'], correct: 2 }],
    });
    expect(res.success).toBe(false);
  });
  it('applies defaults', () => {
    const d = DeckSchema.parse({ id: 'x', title: 'X', slides: [{ type: 'single', id: 'q1', question: 'Q?', options: ['a', 'b'], correct: 1 }] });
    const s = d.slides[0];
    expect(s?.type === 'single' && s.timeLimit).toBe(20);
  });
});

describe('normalizeNickname', () => {
  it('trims and collapses whitespace, strips control characters', () =>
    expect(normalizeNickname('  Ola​ \t  K\u0007 ')).toBe('Ola K'));
});
