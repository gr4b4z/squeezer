import { z } from 'zod';

export const NICKNAME_MAX = 16;

/** Trims, collapses whitespace and strips control characters. */
export function normalizeNickname(raw: string): string {
  return raw.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
}

export const PinSchema = z.string().regex(/^\d{6}$/);

export const HostCommandSchema = z.enum(['next', 'close', 'end']);
export type HostCommand = z.infer<typeof HostCommandSchema>;

/** Messages a client sends over the WebSocket. */
export const ClientMessageSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), role: z.enum(['host', 'presenter']), sessionId: z.string().min(1).max(64), token: z.string().min(16).max(128) }),
  z.object({ t: z.literal('join'), pin: PinSchema, nickname: z.string().min(1).max(64) }),
  z.object({ t: z.literal('resume'), token: z.string().min(16).max(128) }),
  z.object({ t: z.literal('answer'), slideId: z.string().min(1).max(64), option: z.number().int().min(0).max(5) }),
  z.object({ t: z.literal('host'), cmd: HostCommandSchema }),
  z.object({ t: z.literal('ping'), at: z.number() }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type Role = 'host' | 'presenter' | 'participant';
export type Phase = 'lobby' | 'slide' | 'question' | 'reveal' | 'leaderboard' | 'ended';

export interface SessionSettings {
  showLeaderboard: boolean;
  speedScoring: boolean;
  lateJoin: boolean;
}

export type PublicSlide =
  | { kind: 'content'; id: string; title: string; body: string }
  | { kind: 'question'; id: string; text: string; options: string[]; timeLimit: number | null; points: number };

export interface LeaderRow {
  id: string;
  nickname: string;
  rank: number;
  points: number;
  gained: number;
}

export interface HostRow {
  id: string;
  nickname: string;
  connected: boolean;
  /** Option index chosen for the current question, null = not answered. */
  answer: number | null;
  latencyMs: number | null;
  points: number;
  correct: number;
}

export interface MeView {
  id: string;
  nickname: string;
  points: number;
  correct: number;
  rank: number;
  /** Own answer to the current question. */
  answer: number | null;
  /** Points gained on the last revealed question; null before any reveal. */
  gained: number | null;
  streak: number;
  /** Points to the next rank up; 0 when leading. */
  gapToNext: number;
}

/** Full session state as one role sees it. Sent on every state change and on reconnect. */
export interface StateView {
  role: Role;
  seq: number;
  sessionId: string;
  pin: string;
  deckTitle: string;
  phase: Phase;
  slideIndex: number;
  slideCount: number;
  questionNumber: number;
  questionCount: number;
  slide: PublicSlide | null;
  players: number;
  answered: number;
  /** Server epoch ms when answers close; null = no timer. */
  closesAt: number | null;
  serverNow: number;
  settings: SessionSettings;
  /** Nicknames in join order (presenter, host). */
  lobby?: string[];
  reveal?: { correct: number; counts: number[]; pctCorrect: number; explanation?: string };
  leaderboard?: LeaderRow[];
  me?: MeView;
  grid?: HostRow[];
}

export type ServerMessage =
  | { t: 'joined'; token: string; participantId: string; nickname: string }
  | { t: 'state'; state: StateView }
  | { t: 'count'; answered: number; players: number; seq: number }
  | { t: 'answer_ack'; slideId: string; option: number; latencyMs: number }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong'; at: number; serverNow: number };

export type ErrorCode =
  | 'bad_message'
  | 'not_found'
  | 'unauthorized'
  | 'nickname_taken'
  | 'nickname_invalid'
  | 'session_full'
  | 'late_join_closed'
  | 'session_ended'
  | 'not_open'
  | 'already_answered'
  | 'rate_limited'
  | 'kicked';
