/**
 * Load test for the live loop: N simulated phones join one session, the host advances,
 * and we measure host-command → state-received latency on every phone, plus answer acks.
 *
 *   pnpm load                       # 100 players against http://localhost:3001
 *   pnpm load -- --players 200 --sessions 5 --url https://staging.example
 *
 * Exit code 1 when p95 of state changes is 500 ms or more (the MVP exit criterion).
 */
import WebSocket from 'ws';
import type { ServerMessage, StateView } from '@squeezer/shared';

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]! : def;
};
const BASE = arg('url', 'http://localhost:3001').replace(/\/$/, '');
const PLAYERS = Number(arg('players', '100'));
const SESSIONS = Number(arg('sessions', '1'));
const DECK = arg('deck', 'rozgrzewka');
const WS = BASE.replace(/^http/, 'ws') + '/ws';

type State = StateView;

class Sock {
  ws: WebSocket;
  last: State | null = null;
  private waiters: { pred: (m: ServerMessage) => boolean; res: (m: ServerMessage) => void }[] = [];
  constructor() {
    this.ws = new WebSocket(WS);
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMessage;
      if (m.t === 'state') this.last = m.state;
      this.waiters = this.waiters.filter((w) => (w.pred(m) ? (w.res(m), false) : true));
    });
  }
  open = () => new Promise<void>((r, j) => (this.ws.once('open', () => r()), this.ws.once('error', j)));
  send = (m: object) => this.ws.send(JSON.stringify(m));
  wait = (pred: (m: ServerMessage) => boolean, ms = 10_000) =>
    new Promise<ServerMessage>((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), ms);
      this.waiters.push({ pred, res: (m) => (clearTimeout(t), res(m)) });
    });
}

const pct = (xs: number[], p: number) => {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? NaN;
};

async function runSession(idx: number, stateLat: number[], ackLat: number[]) {
  const r = await fetch(`${BASE}/api/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deckId: DECK }) });
  if (!r.ok) throw new Error(`create session: ${r.status}`);
  const s = (await r.json()) as { sessionId: string; pin: string; hostToken: string };
  const host = new Sock();
  await host.open();
  host.send({ t: 'hello', role: 'host', sessionId: s.sessionId, token: s.hostToken });
  if (!host.last) await host.wait((m) => m.t === 'state');

  const players: Sock[] = [];
  for (let i = 0; i < PLAYERS; i += 25) {
    await Promise.all(
      Array.from({ length: Math.min(25, PLAYERS - i) }, async (_, k) => {
        const p = new Sock();
        await p.open();
        p.send({ t: 'join', pin: s.pin, nickname: `S${idx}P${i + k}` });
        await p.wait((m) => m.t === 'joined');
        players.push(p);
      }),
    );
  }

  const step = async () => {
    const seq = host.last?.seq ?? 0;
    const t0 = performance.now();
    const got = players.map((p) => p.wait((m) => m.t === 'state' && m.state.seq > seq).then(() => stateLat.push(performance.now() - t0)));
    host.send({ t: 'host', cmd: 'next' });
    await Promise.all(got);
    if ((host.last?.seq ?? 0) <= seq) await host.wait((m) => m.t === 'state' && m.state.seq > seq);
  };

  // Walk the whole deck: every question gets answered by everyone (the last answer closes it).
  for (let guard = 0; guard < 100; guard++) {
    const phase = players[0]!.last?.phase;
    if (phase === 'ended') break;
    if (phase === 'question') {
      const q = players[0]!.last!.slide;
      if (q?.kind !== 'question') break;
      const seq = players[0]!.last!.seq;
      const reveal = players.map((p) => p.wait((m) => m.t === 'state' && m.state.seq > seq && m.state.phase === 'reveal'));
      await Promise.all(
        players.map(async (p) => {
          const t0 = performance.now();
          const ack = p.wait((m) => m.t === 'answer_ack' || m.t === 'error');
          p.send({ t: 'answer', slideId: q.id, option: Math.floor(Math.random() * q.options.length) });
          await ack;
          ackLat.push(performance.now() - t0);
        }),
      );
      await Promise.all(reveal);
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }
    await step();
  }
  [host, ...players].forEach((c) => c.ws.close());
}

const stateLat: number[] = [];
const ackLat: number[] = [];
const t0 = performance.now();
await Promise.all(Array.from({ length: SESSIONS }, (_, i) => runSession(i, stateLat, ackLat)));
const p95 = pct(stateLat, 95);
const f = (n: number) => `${n.toFixed(1)} ms`;
console.log(`sessions: ${SESSIONS} × ${PLAYERS} players against ${BASE}  (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
console.log(`state change → phone: n=${stateLat.length}  p50 ${f(pct(stateLat, 50))}  p95 ${f(p95)}  max ${f(Math.max(...stateLat))}`);
console.log(`answer → ack:         n=${ackLat.length}  p50 ${f(pct(ackLat, 50))}  p95 ${f(pct(ackLat, 95))}  max ${f(Math.max(...ackLat))}`);
console.log(p95 < 500 ? 'PASS: p95 under 500 ms' : 'FAIL: p95 is 500 ms or more');
process.exit(p95 < 500 ? 0 : 1);
