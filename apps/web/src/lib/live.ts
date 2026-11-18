import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ClientMessage, ErrorCode, ServerMessage, StateView } from '@squeezer/shared';

export type Status = 'connecting' | 'open' | 'reconnecting';

export interface LiveSnapshot {
  status: Status;
  state: StateView | null;
  /** serverNow − clientNow, from ping/pong; add to Date.now() to get server time. */
  offset: number;
  error: { code: ErrorCode; message: string; at: number } | null;
  joined: { participantId: string; nickname: string } | null;
  ack: { slideId: string; option: number; latencyMs: number } | null;
}

type Handshake = () => ClientMessage | null;

/**
 * One WebSocket to the gateway. Reconnects with backoff and re-sends the handshake,
 * so the server replies with the full current state (not a diff).
 */
export class LiveConnection {
  private ws: WebSocket | null = null;
  private snap: LiveSnapshot = { status: 'connecting', state: null, offset: 0, error: null, joined: null, ack: null };
  private readonly listeners = new Set<() => void>();
  private retries = 0;
  private closed = false;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  onJoined: ((m: Extract<ServerMessage, { t: 'joined' }>) => void) | null = null;

  constructor(private handshake: Handshake) {}

  setHandshake(h: Handshake) {
    this.handshake = h;
  }

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    clearInterval(this.pingTimer);
    clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snap;

  send(m: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(m));
    return true;
  }

  clearError() {
    this.set({ error: null });
  }

  private set(p: Partial<LiveSnapshot>) {
    this.snap = { ...this.snap, ...p };
    this.listeners.forEach((fn) => fn());
  }

  private connect() {
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      this.set({ status: 'open' });
      const h = this.handshake();
      if (h) ws.send(JSON.stringify(h));
      this.ping();
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.ping(), 10_000);
    };
    ws.onmessage = (e) => {
      if (this.ws === ws) this.onMessage(JSON.parse(String(e.data)) as ServerMessage);
    };
    ws.onclose = () => {
      // A socket replaced by a newer one (StrictMode remount, manual restart) must not reconnect.
      if (this.ws !== ws || this.closed) return;
      clearInterval(this.pingTimer);
      this.set({ status: 'reconnecting' });
      const delay = Math.min(5000, 400 * 2 ** this.retries++) * (0.75 + Math.random() * 0.5);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private ping() {
    this.send({ t: 'ping', at: Date.now() });
  }

  private onMessage(m: ServerMessage) {
    switch (m.t) {
      case 'state': {
        const cur = this.snap.state;
        if (cur && cur.sessionId === m.state.sessionId && m.state.seq < cur.seq) return;
        const ack = this.snap.ack && m.state.slide?.id === this.snap.ack.slideId ? this.snap.ack : null;
        this.set({ state: m.state, ack });
        return;
      }
      case 'count': {
        const cur = this.snap.state;
        if (cur && cur.seq === m.seq) this.set({ state: { ...cur, answered: m.answered, players: m.players } });
        return;
      }
      case 'answer_ack':
        this.set({ ack: { slideId: m.slideId, option: m.option, latencyMs: m.latencyMs } });
        return;
      case 'joined':
        this.onJoined?.(m);
        this.set({ joined: { participantId: m.participantId, nickname: m.nickname }, error: null });
        return;
      case 'error':
        this.set({ error: { code: m.code, message: m.message, at: Date.now() } });
        return;
      case 'pong': {
        const now = Date.now();
        this.set({ offset: m.serverNow - (m.at + (now - m.at) / 2) });
        return;
      }
    }
  }
}

/** Opens a connection for the component's lifetime. */
export function useLive(handshake: Handshake) {
  const conn = useMemo(() => new LiveConnection(handshake), []); // eslint-disable-line react-hooks/exhaustive-deps
  conn.setHandshake(handshake);
  useEffect(() => {
    conn.start();
    return () => conn.stop();
  }, [conn]);
  const snap = useSyncExternalStore(conn.subscribe, conn.getSnapshot);
  return { conn, ...snap };
}
