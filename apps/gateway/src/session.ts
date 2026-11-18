import {
  NICKNAME_MAX,
  normalizeNickname,
  rankPlayers,
  scoreAnswer,
  type Deck,
  type ErrorCode,
  type HostCommand,
  type HostRow,
  type LeaderRow,
  type MeView,
  type Phase,
  type PublicSlide,
  type Role,
  type SessionSettings,
  type SingleSlide,
  type Slide,
  type StateView,
} from '@squeezer/shared';
import { hashToken, newToken, tokenMatches } from './tokens.ts';

export interface Participant {
  id: string;
  nickname: string;
  tokenHash: string;
  joinedAt: number;
  points: number;
  correct: number;
  /** Sum of latencies of correct answers, for tie-breaks. */
  latencyMs: number;
  streak: number;
  gained: number | null;
  sockets: number;
}

interface Answer {
  option: number;
  latencyMs: number;
}

export type Change = 'state' | 'count';
export type Clock = () => number;
export type Scheduler = (ms: number, fn: () => void) => () => void;

const defaultScheduler: Scheduler = (ms, fn) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};

export type Result<T> = ({ ok: true } & T) | { ok: false; code: ErrorCode };

export interface SessionOptions {
  id: string;
  pin: string;
  deck: Deck;
  settings: SessionSettings;
  hostTokenHash: string;
  presenterTokenHash: string;
  maxParticipants: number;
  now?: Clock;
  schedule?: Scheduler;
  /** Minimum interval between answered-count broadcasts. */
  countThrottleMs?: number;
}

/**
 * One live session. The server owns all state; clients only render the views produced here.
 * Transitions happen only on host commands or the server timer.
 */
export class LiveSession {
  readonly id: string;
  readonly pin: string;
  readonly deck: Deck;
  readonly settings: SessionSettings;
  readonly createdAt: number;

  phase: Phase = 'lobby';
  slideIndex = -1;
  seq = 0;
  closesAt: number | null = null;
  endedAt: number | null = null;
  hostSockets = 0;
  hostLeftAt: number;

  private readonly participants = new Map<string, Participant>();
  private readonly answers = new Map<string, Map<string, Answer>>();
  private readonly listeners = new Set<(c: Change) => void>();
  private readonly hostTokenHash: string;
  private readonly presenterTokenHash: string;
  private readonly maxParticipants: number;
  private readonly now: Clock;
  private readonly schedule: Scheduler;
  private readonly countThrottleMs: number;
  private openedAt = 0;
  private cancelTimer: (() => void) | null = null;
  private countPending = false;
  private nextPid = 1;
  private rankCache: { seq: number; ranks: Map<string, number>; order: Participant[] } | null = null;
  private readonly pointsBefore = new Map<string, number>();

  constructor(o: SessionOptions) {
    this.id = o.id;
    this.pin = o.pin;
    this.deck = o.deck;
    this.settings = o.settings;
    this.hostTokenHash = o.hostTokenHash;
    this.presenterTokenHash = o.presenterTokenHash;
    this.maxParticipants = o.maxParticipants;
    this.now = o.now ?? Date.now;
    this.schedule = o.schedule ?? defaultScheduler;
    this.countThrottleMs = o.countThrottleMs ?? 100;
    this.createdAt = this.now();
    this.hostLeftAt = this.createdAt;
  }

  // ---------- subscriptions ----------

  on(fn: (c: Change) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(c: Change): void {
    if (c === 'state') this.seq++;
    for (const fn of this.listeners) fn(c);
  }

  private emitCount(): void {
    if (this.countPending) return;
    this.countPending = true;
    this.schedule(this.countThrottleMs, () => {
      this.countPending = false;
      if (this.phase === 'question') this.emit('count');
    });
  }

  // ---------- roles ----------

  verify(role: 'host' | 'presenter', token: string): boolean {
    if (role === 'host') return tokenMatches(token, this.hostTokenHash);
    return tokenMatches(token, this.presenterTokenHash) || tokenMatches(token, this.hostTokenHash);
  }

  hostConnected(delta: 1 | -1): void {
    this.hostSockets += delta;
    if (this.hostSockets === 0) this.hostLeftAt = this.now();
  }

  // ---------- participants ----------

  get playerCount(): number {
    return this.participants.size;
  }

  getParticipant(id: string): Participant | undefined {
    return this.participants.get(id);
  }

  join(rawNickname: string): Result<{ participant: Participant; token: string }> {
    if (this.phase === 'ended') return { ok: false, code: 'session_ended' };
    if (this.phase !== 'lobby' && !this.settings.lateJoin) return { ok: false, code: 'late_join_closed' };
    if (this.participants.size >= this.maxParticipants) return { ok: false, code: 'session_full' };
    const nickname = normalizeNickname(rawNickname);
    if ([...nickname].length < 1 || [...nickname].length > NICKNAME_MAX) return { ok: false, code: 'nickname_invalid' };
    const key = nickname.toLocaleLowerCase('pl');
    for (const p of this.participants.values()) {
      if (p.nickname.toLocaleLowerCase('pl') === key) return { ok: false, code: 'nickname_taken' };
    }
    const token = newToken();
    const participant: Participant = {
      id: `p${this.nextPid++}`,
      nickname,
      tokenHash: hashToken(token),
      joinedAt: this.now(),
      points: 0,
      correct: 0,
      latencyMs: 0,
      streak: 0,
      gained: null,
      sockets: 0,
    };
    this.participants.set(participant.id, participant);
    this.pointsBefore.set(participant.id, 0);
    this.emit('state');
    return { ok: true, participant, token };
  }

  participantConnected(id: string, delta: 1 | -1): void {
    const p = this.participants.get(id);
    if (!p) return;
    const wasOnline = p.sockets > 0;
    p.sockets = Math.max(0, p.sockets + delta);
    if (wasOnline !== p.sockets > 0) this.emit('state');
  }

  // ---------- slides ----------

  get slide(): Slide | null {
    return this.deck.slides[this.slideIndex] ?? null;
  }

  private get question(): SingleSlide | null {
    const s = this.slide;
    return s && s.type === 'single' ? s : null;
  }

  private answersFor(slideId: string): Map<string, Answer> {
    let m = this.answers.get(slideId);
    if (!m) this.answers.set(slideId, (m = new Map()));
    return m;
  }

  command(cmd: HostCommand): boolean {
    switch (cmd) {
      case 'end':
        if (this.phase === 'ended') return false;
        this.end();
        return true;
      case 'close':
        if (this.phase !== 'question') return false;
        this.closeQuestion();
        return true;
      case 'next':
        return this.next();
    }
  }

  private next(): boolean {
    switch (this.phase) {
      case 'lobby':
      case 'slide':
      case 'leaderboard':
        this.openSlide(this.slideIndex + 1);
        return true;
      case 'question':
        this.closeQuestion();
        return true;
      case 'reveal': {
        const more = this.slideIndex + 1 < this.deck.slides.length;
        if (more && this.settings.showLeaderboard) {
          this.phase = 'leaderboard';
          this.emit('state');
        } else {
          this.openSlide(this.slideIndex + 1);
        }
        return true;
      }
      case 'ended':
        return false;
    }
  }

  private openSlide(index: number): void {
    const slide = this.deck.slides[index];
    if (!slide) return this.end();
    this.slideIndex = index;
    this.closesAt = null;
    if (slide.type === 'content') {
      this.phase = 'slide';
    } else {
      this.phase = 'question';
      for (const p of this.participants.values()) this.pointsBefore.set(p.id, p.points);
      this.openedAt = this.now();
      if (slide.timeLimit !== null) {
        const ms = slide.timeLimit * 1000;
        this.closesAt = this.openedAt + ms;
        this.cancelTimer = this.schedule(ms, () => {
          if (this.phase === 'question' && this.slide?.id === slide.id) this.closeQuestion();
        });
      }
    }
    this.emit('state');
  }

  private closeQuestion(): void {
    const q = this.question;
    if (!q) return;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.closesAt = null;
    const answers = this.answersFor(q.id);
    for (const p of this.participants.values()) {
      const a = answers.get(p.id);
      const isCorrect = !!a && a.option === q.correct;
      const gained = a
        ? scoreAnswer({
            isCorrect,
            points: q.points,
            latencyMs: a.latencyMs,
            timeLimitMs: q.timeLimit === null ? null : q.timeLimit * 1000,
            speedScoring: this.settings.speedScoring,
          })
        : 0;
      p.points += gained;
      p.gained = gained;
      if (isCorrect && a) {
        p.correct++;
        p.latencyMs += a.latencyMs;
        p.streak++;
      } else {
        p.streak = 0;
      }
    }
    this.phase = 'reveal';
    this.emit('state');
  }

  private end(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.closesAt = null;
    this.phase = 'ended';
    this.endedAt = this.now();
    this.emit('state');
  }

  answer(participantId: string, slideId: string, option: number): Result<{ latencyMs: number }> {
    const q = this.question;
    if (this.phase !== 'question' || !q || q.id !== slideId) return { ok: false, code: 'not_open' };
    const now = this.now();
    if (this.closesAt !== null && now > this.closesAt) return { ok: false, code: 'not_open' };
    if (option < 0 || option >= q.options.length) return { ok: false, code: 'bad_message' };
    if (!this.participants.has(participantId)) return { ok: false, code: 'not_found' };
    const answers = this.answersFor(q.id);
    if (answers.has(participantId)) return { ok: false, code: 'already_answered' };
    const latencyMs = now - this.openedAt;
    answers.set(participantId, { option, latencyMs });
    if (answers.size >= this.participants.size) this.closeQuestion();
    else this.emitCount();
    return { ok: true, latencyMs };
  }

  // ---------- views ----------

  private ranking(): { ranks: Map<string, number>; order: Participant[] } {
    if (this.rankCache?.seq === this.seq) return this.rankCache;
    const ranked = rankPlayers([...this.participants.values()]);
    this.rankCache = {
      seq: this.seq,
      ranks: new Map(ranked.map((r) => [r.row.id, r.rank])),
      order: ranked.map((r) => r.row),
    };
    return this.rankCache;
  }

  private publicSlide(): PublicSlide | null {
    if (this.phase === 'lobby' || this.phase === 'ended') return null;
    const s = this.slide;
    if (!s) return null;
    if (s.type === 'content') return { kind: 'content', id: s.id, title: s.title, body: s.body };
    return { kind: 'question', id: s.id, text: s.question, options: s.options, timeLimit: s.timeLimit, points: s.points };
  }

  get answeredCount(): number {
    const q = this.question;
    return q ? this.answersFor(q.id).size : 0;
  }

  view(role: Role, participantId?: string): StateView {
    const q = this.question;
    const answers = q ? this.answersFor(q.id) : null;
    const questions = this.deck.slides.filter((s) => s.type === 'single');
    const questionNumber = this.deck.slides.slice(0, this.slideIndex + 1).filter((s) => s.type === 'single').length;
    const v: StateView = {
      role,
      seq: this.seq,
      sessionId: this.id,
      pin: this.pin,
      deckTitle: this.deck.title,
      phase: this.phase,
      slideIndex: this.slideIndex,
      slideCount: this.deck.slides.length,
      questionNumber,
      questionCount: questions.length,
      slide: this.publicSlide(),
      players: this.participants.size,
      answered: this.phase === 'question' || this.phase === 'reveal' ? this.answeredCount : 0,
      closesAt: this.closesAt,
      serverNow: this.now(),
      settings: this.settings,
    };

    if (this.phase === 'reveal' && q && answers) {
      const counts = q.options.map(() => 0);
      for (const a of answers.values()) counts[a.option] = (counts[a.option] ?? 0) + 1;
      const right = counts[q.correct] ?? 0;
      v.reveal = {
        correct: q.correct,
        counts,
        pctCorrect: this.participants.size ? Math.round((100 * right) / this.participants.size) : 0,
        ...(q.explanation ? { explanation: q.explanation } : {}),
      };
    }

    const { ranks, order } = this.ranking();

    if (role !== 'participant') {
      if (this.phase === 'lobby' || this.phase === 'slide') v.lobby = [...this.participants.values()].map((p) => p.nickname);
      if (this.phase === 'leaderboard' || this.phase === 'ended') {
        v.leaderboard = order.slice(0, 5).map<LeaderRow>((p) => ({
          id: p.id,
          nickname: p.nickname,
          rank: ranks.get(p.id) ?? 0,
          points: p.points,
          gained: this.phase === 'ended' ? 0 : p.points - (this.pointsBefore.get(p.id) ?? 0),
        }));
      }
    }

    if (role === 'host') {
      v.grid = order.map<HostRow>((p) => {
        const a = answers?.get(p.id);
        return {
          id: p.id,
          nickname: p.nickname,
          connected: p.sockets > 0,
          answer: a ? a.option : null,
          latencyMs: a ? a.latencyMs : null,
          points: p.points,
          correct: p.correct,
        };
      });
    }

    if (role === 'participant' && participantId) {
      const p = this.participants.get(participantId);
      if (p) {
        const rank = ranks.get(p.id) ?? 0;
        const idx = order.indexOf(p);
        const ahead = idx > 0 ? order[idx - 1] : undefined;
        const me: MeView = {
          id: p.id,
          nickname: p.nickname,
          points: p.points,
          correct: p.correct,
          rank,
          answer: answers?.get(p.id)?.option ?? null,
          gained: p.gained,
          streak: p.streak,
          gapToNext: ahead ? ahead.points - p.points : 0,
        };
        v.me = me;
      }
    }
    return v;
  }
}
