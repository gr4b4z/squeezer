import { describe, expect, it } from 'vitest';
import { SessionStore } from '../src/store.ts';
import { deck, fakeTime } from './helpers.ts';

function setup(settings = {}) {
  const t = fakeTime();
  const store = new SessionStore({ maxParticipants: 3, now: t.now, schedule: t.schedule });
  const { session, hostToken, presenterToken } = store.create(deck, settings);
  return { t, store, session, hostToken, presenterToken };
}

describe('LiveSession', () => {
  it('issues a 6-digit PIN and checks role tokens', () => {
    const { session, hostToken, presenterToken } = setup();
    expect(session.pin).toMatch(/^\d{6}$/);
    expect(session.verify('host', hostToken)).toBe(true);
    expect(session.verify('host', presenterToken)).toBe(false);
    expect(session.verify('presenter', presenterToken)).toBe(true);
    expect(session.verify('presenter', 'x'.repeat(32))).toBe(false);
  });

  it('enforces unique, valid nicknames and the participant cap', () => {
    const { store, session } = setup();
    expect(store.join(session, '  Ola ').ok).toBe(true);
    expect(store.join(session, 'OLA')).toEqual({ ok: false, code: 'nickname_taken' });
    expect(store.join(session, '   ')).toEqual({ ok: false, code: 'nickname_invalid' });
    expect(store.join(session, 'x'.repeat(17))).toEqual({ ok: false, code: 'nickname_invalid' });
    store.join(session, 'Ala');
    store.join(session, 'Ela');
    expect(store.join(session, 'Iza')).toEqual({ ok: false, code: 'session_full' });
  });

  it('runs lobby → slide → question → reveal → leaderboard → question → reveal → ended', () => {
    const { t, store, session } = setup();
    const a = store.join(session, 'Ala');
    const b = store.join(session, 'Bartek');
    if (!a.ok || !b.ok) throw new Error('join failed');

    session.command('next');
    expect(session.phase).toBe('slide');
    expect(session.view('participant', a.participant.id).slide).toMatchObject({ kind: 'content', title: 'Hello' });

    session.command('next');
    expect(session.phase).toBe('question');
    const pv = session.view('participant', a.participant.id);
    expect(pv.slide).toMatchObject({ kind: 'question', options: ['a', 'b', 'c', 'd'] });
    expect(pv.slide).not.toHaveProperty('correct'); // never leak the key before the reveal
    expect(pv.reveal).toBeUndefined();
    expect(pv.closesAt).toBe(t.now() + 20_000);

    t.advance(1_500);
    expect(session.answer(a.participant.id, 'q1', 1)).toEqual({ ok: true, latencyMs: 1_500 });
    expect(session.answer(a.participant.id, 'q1', 2)).toEqual({ ok: false, code: 'already_answered' });
    expect(session.answer(b.participant.id, 'q2', 0)).toEqual({ ok: false, code: 'not_open' });

    // Timer closes the question when not everyone answered.
    t.advance(20_000);
    expect(session.phase).toBe('reveal');
    const host = session.view('host');
    expect(host.reveal).toEqual({ correct: 1, counts: [0, 1, 0, 0], pctCorrect: 50 });
    expect(host.grid?.map((r) => [r.nickname, r.answer, r.points])).toEqual([
      ['Ala', 1, 1000],
      ['Bartek', null, 0],
    ]);
    expect(session.view('participant', b.participant.id).me).toMatchObject({ gained: 0, rank: 2, gapToNext: 1000 });

    session.command('next');
    expect(session.phase).toBe('leaderboard');
    expect(session.view('presenter').leaderboard?.[0]).toMatchObject({ nickname: 'Ala', gained: 1000, rank: 1 });

    session.command('next');
    expect(session.phase).toBe('question');
    expect(session.closesAt).toBeNull(); // q2 has no time limit
    session.answer(a.participant.id, 'q2', 1);
    session.answer(b.participant.id, 'q2', 0);
    // Everyone answered → closes at once.
    expect(session.phase).toBe('reveal');
    expect(session.view('participant', b.participant.id).me).toMatchObject({ points: 1000, streak: 1 });

    session.command('next'); // last slide: no leaderboard, straight to the end
    expect(session.phase).toBe('ended');
    expect(session.view('presenter').leaderboard?.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('rejects answers after the close time', () => {
    const { t, store, session } = setup();
    const a = store.join(session, 'Ala');
    store.join(session, 'Bea');
    if (!a.ok) throw new Error();
    session.command('next');
    session.command('next');
    t.advance(25_000);
    expect(session.answer(a.participant.id, 'q1', 1)).toEqual({ ok: false, code: 'not_open' });
  });

  it('scores by speed when the host turns it on', () => {
    const { t, store, session } = setup({ speedScoring: true });
    const a = store.join(session, 'Ala');
    if (!a.ok) throw new Error();
    session.command('next');
    session.command('next');
    t.advance(10_000);
    session.answer(a.participant.id, 'q1', 1);
    expect(session.view('participant', a.participant.id).me?.points).toBe(750);
  });

  it('blocks late joins when the host turned them off, and releases the PIN at the end', () => {
    const { store, session } = setup({ lateJoin: false });
    store.join(session, 'Ala');
    session.command('next');
    expect(store.join(session, 'Bea')).toEqual({ ok: false, code: 'late_join_closed' });
    expect(store.byPin(session.pin)).toBe(session);
    session.command('end');
    expect(store.byPin(session.pin)).toBeUndefined();
  });

  it('resolves participant tokens for reconnects', () => {
    const { store, session } = setup();
    const a = store.join(session, 'Ala');
    if (!a.ok) throw new Error();
    expect(store.resolveToken(a.token)?.participantId).toBe(a.participant.id);
    expect(store.resolveToken('nope'.repeat(8))).toBeUndefined();
  });

  it('ends a session whose host has been away for 10 minutes', () => {
    const { t, store, session } = setup();
    t.advance(11 * 60_000);
    store.sweep();
    expect(session.phase).toBe('ended');
  });
});
