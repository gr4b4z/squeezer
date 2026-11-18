import { DeckSchema, type Deck } from '@squeezer/shared';
import type { Scheduler } from '../src/session.ts';

export const deck: Deck = DeckSchema.parse({
  id: 'test',
  title: 'Test',
  slides: [
    { type: 'content', id: 'intro', title: 'Hello' },
    { type: 'single', id: 'q1', question: 'One?', options: ['a', 'b', 'c', 'd'], correct: 1, timeLimit: 20 },
    { type: 'single', id: 'q2', question: 'Two?', options: ['a', 'b'], correct: 0, timeLimit: null },
  ],
});

/** Manual clock and timer queue so tests control time exactly. */
export function fakeTime(start = 1_000_000) {
  let now = start;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const schedule: Scheduler = (ms, fn) => {
    const id = nextId++;
    timers.push({ at: now + ms, fn, id });
    return () => (timers = timers.filter((t) => t.id !== id));
  };
  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > target) break;
      timers.shift();
      now = t.at;
      t.fn();
    }
    now = target;
  };
  return { now: () => now, schedule, advance };
}
