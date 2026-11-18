import { describe, expect, it } from 'vitest';
import { playersWord, t } from './pl.ts';

describe('playersWord', () => {
  it.each([
    [1, 'gracz'],
    [2, 'gracze'],
    [4, 'gracze'],
    [5, 'graczy'],
    [12, 'graczy'],
    [14, 'graczy'],
    [22, 'gracze'],
    [25, 'graczy'],
    [104, 'gracze'],
    [112, 'graczy'],
  ])('%i → %s', (n, w) => expect(playersWord(n)).toBe(w));

  it('is used in counts', () => expect(t.stage.end(23)).toBe('Koniec gry · 23 gracze'));
});
