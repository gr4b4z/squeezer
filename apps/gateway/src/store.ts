import { randomInt, randomUUID } from 'node:crypto';
import type { Deck, SessionSettings } from '@squeezer/shared';
import { LiveSession, type Clock, type Scheduler } from './session.ts';
import { hashToken, newToken } from './tokens.ts';

const HOUR = 3_600_000;

export interface StoreOptions {
  maxParticipants: number;
  now?: Clock;
  schedule?: Scheduler;
  /** A PIN is not reused within this time after its session ends. */
  pinCooldownMs?: number;
  /** A session with no host connected for this long is ended. */
  hostAbsenceMs?: number;
}

export const DEFAULT_SETTINGS: SessionSettings = { showLeaderboard: true, speedScoring: false, lateJoin: true };

/** In-memory session store. Step 6 of the build order moves live state to Redis. */
export class SessionStore {
  private readonly sessions = new Map<string, LiveSession>();
  private readonly activePins = new Map<string, string>();
  private readonly coolingPins = new Map<string, number>();
  private readonly tokens = new Map<string, { sessionId: string; participantId: string }>();
  private readonly now: Clock;

  constructor(private readonly o: StoreOptions) {
    this.now = o.now ?? Date.now;
  }

  get size(): number {
    return this.sessions.size;
  }

  create(deck: Deck, settings: Partial<SessionSettings> = {}) {
    const pin = this.newPin();
    const hostToken = newToken();
    const presenterToken = newToken();
    const session = new LiveSession({
      id: randomUUID(),
      pin,
      deck,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      hostTokenHash: hashToken(hostToken),
      presenterTokenHash: hashToken(presenterToken),
      maxParticipants: this.o.maxParticipants,
      now: this.now,
      ...(this.o.schedule ? { schedule: this.o.schedule } : {}),
    });
    this.sessions.set(session.id, session);
    this.activePins.set(pin, session.id);
    session.on((c) => {
      if (c === 'state' && session.phase === 'ended') this.releasePin(session);
    });
    return { session, hostToken, presenterToken };
  }

  join(session: LiveSession, nickname: string) {
    const res = session.join(nickname);
    if (res.ok) this.tokens.set(res.participant.tokenHash, { sessionId: session.id, participantId: res.participant.id });
    return res;
  }

  byId(id: string): LiveSession | undefined {
    return this.sessions.get(id);
  }

  /** Only sessions that still accept joins hold a PIN. */
  byPin(pin: string): LiveSession | undefined {
    const id = this.activePins.get(pin);
    return id ? this.sessions.get(id) : undefined;
  }

  resolveToken(token: string): { session: LiveSession; participantId: string } | undefined {
    const ref = this.tokens.get(hashToken(token));
    if (!ref) return undefined;
    const session = this.sessions.get(ref.sessionId);
    if (!session || !session.getParticipant(ref.participantId)) return undefined;
    return { session, participantId: ref.participantId };
  }

  private releasePin(session: LiveSession): void {
    if (this.activePins.get(session.pin) === session.id) {
      this.activePins.delete(session.pin);
      this.coolingPins.set(session.pin, this.now());
    }
  }

  private newPin(): string {
    for (let i = 0; i < 1000; i++) {
      const pin = String(randomInt(100_000, 1_000_000));
      if (!this.activePins.has(pin) && !this.coolingPins.has(pin)) return pin;
    }
    throw new Error('No free PIN');
  }

  /** Ends abandoned sessions, forgets old ones and frees cooled-down PINs. Call periodically. */
  sweep(): void {
    const now = this.now();
    const absence = this.o.hostAbsenceMs ?? 10 * 60_000;
    const cooldown = this.o.pinCooldownMs ?? 24 * HOUR;
    for (const s of this.sessions.values()) {
      if (s.phase !== 'ended' && s.hostSockets === 0 && now - s.hostLeftAt > absence) s.command('end');
      if (s.endedAt !== null && now - s.endedAt > HOUR) {
        this.sessions.delete(s.id);
        for (const [hash, ref] of this.tokens) if (ref.sessionId === s.id) this.tokens.delete(hash);
      }
    }
    for (const [pin, at] of this.coolingPins) if (now - at > cooldown) this.coolingPins.delete(pin);
  }
}
