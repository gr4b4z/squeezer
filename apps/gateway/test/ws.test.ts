import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ServerMessage, StateView } from '@squeezer/shared';
import { buildServer } from '../src/server.ts';
import { deck } from './helpers.ts';

let base = '';
let close: () => Promise<void>;

beforeAll(async () => {
  const { app } = await buildServer({ decks: new Map([[deck.id, deck]]) });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  if (!addr || typeof addr === 'string') throw new Error('no address');
  base = `127.0.0.1:${addr.port}`;
  close = () => app.close();
});
afterAll(() => close());

class Client {
  ws: WebSocket;
  inbox: ServerMessage[] = [];
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
  constructor() {
    this.ws = new WebSocket(`ws://${base}/ws`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMessage;
      const w = this.waiters.find((x) => x.pred(m));
      if (w) {
        this.waiters = this.waiters.filter((x) => x !== w);
        w.resolve(m);
      } else this.inbox.push(m);
    });
  }
  open() {
    return new Promise<void>((r) => this.ws.once('open', () => r()));
  }
  send(m: object) {
    this.ws.send(JSON.stringify(m));
  }
  next(pred: (m: ServerMessage) => boolean, timeoutMs = 2000): Promise<ServerMessage> {
    const hit = this.inbox.find(pred);
    if (hit) {
      this.inbox = this.inbox.filter((m) => m !== hit);
      return Promise.resolve(hit);
    }
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
      this.waiters.push({ pred, resolve: (m) => (clearTimeout(t), resolve(m)) });
    });
  }
  async phase(p: StateView['phase']): Promise<StateView> {
    const m = await this.next((x) => x.t === 'state' && x.state.phase === p);
    return (m as Extract<ServerMessage, { t: 'state' }>).state;
  }
  close() {
    this.ws.close();
  }
}

async function createSession() {
  const res = await fetch(`http://${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deckId: 'test' }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { sessionId: string; pin: string; hostToken: string; presenterToken: string };
}

describe('gateway over WebSocket', () => {
  it('runs the live loop for 20 participants, with a reconnect mid-question', async () => {
    const s = await createSession();
    expect(await (await fetch(`http://${base}/api/pins/${s.pin}`)).json()).toEqual({ ok: true, deckTitle: 'Test' });

    const host = new Client();
    await host.open();
    host.send({ t: 'hello', role: 'host', sessionId: s.sessionId, token: s.hostToken });
    await host.phase('lobby');

    const players: Client[] = [];
    const tokens: string[] = [];
    for (let i = 0; i < 20; i++) {
      const c = new Client();
      await c.open();
      c.send({ t: 'join', pin: s.pin, nickname: `Gracz ${i}` });
      const j = await c.next((m) => m.t === 'joined');
      tokens.push((j as Extract<ServerMessage, { t: 'joined' }>).token);
      players.push(c);
    }

    host.send({ t: 'host', cmd: 'next' }); // content slide
    await Promise.all(players.map((p) => p.phase('slide')));
    host.send({ t: 'host', cmd: 'next' }); // q1
    const q = await players[0]!.phase('question');
    expect(q.slide).toMatchObject({ kind: 'question', id: 'q1' });
    await Promise.all(players.slice(1).map((p) => p.phase('question')));

    // Player 0 drops and comes back with its token: full state, same identity.
    players[0]!.close();
    const back = new Client();
    await back.open();
    back.send({ t: 'resume', token: tokens[0] });
    expect(await back.next((m) => m.t === 'joined')).toMatchObject({ nickname: 'Gracz 0' });
    expect((await back.phase('question')).slide).toMatchObject({ id: 'q1' });
    players[0] = back;

    // Half answer correctly (option 1), the rest wrong; the last answer closes the question.
    for (const [i, p] of players.entries()) {
      p.send({ t: 'answer', slideId: 'q1', option: i % 2 ? 0 : 1 });
      await p.next((m) => m.t === 'answer_ack');
    }
    const r0 = await players[0]!.phase('reveal');
    expect(r0.reveal).toMatchObject({ correct: 1, counts: [10, 10, 0, 0], pctCorrect: 50 });
    expect(r0.me).toMatchObject({ nickname: 'Gracz 0', gained: 1000, points: 1000 });
    const hr = await host.phase('reveal');
    expect(hr.grid).toHaveLength(20);
    expect(hr.grid?.filter((g) => g.answer === 1)).toHaveLength(10);

    // Answers after the close are refused.
    players[1]!.send({ t: 'answer', slideId: 'q1', option: 1 });
    expect(await players[1]!.next((m) => m.t === 'error')).toMatchObject({ code: 'not_open' });

    host.send({ t: 'host', cmd: 'end' });
    await Promise.all(players.map((p) => p.phase('ended')));
    [host, ...players].forEach((c) => c.close());
  });

  it('refuses host commands from participants and bad tokens', async () => {
    const s = await createSession();
    const p = new Client();
    await p.open();
    p.send({ t: 'join', pin: s.pin, nickname: 'Ola' });
    await p.next((m) => m.t === 'joined');
    p.send({ t: 'host', cmd: 'next' });
    expect(await p.next((m) => m.t === 'error')).toMatchObject({ code: 'unauthorized' });

    const h = new Client();
    await h.open();
    h.send({ t: 'hello', role: 'host', sessionId: s.sessionId, token: s.presenterToken });
    expect(await h.next((m) => m.t === 'error')).toMatchObject({ code: 'unauthorized' });
    p.send({ t: 'join', pin: s.pin, nickname: 'ola' });
    [p, h].forEach((c) => c.close());
  });

  it('locks out an IP after 10 wrong PINs, but not after many successful joins', async () => {
    const s = await createSession();
    for (let i = 0; i < 25; i++) {
      const r = await fetch(`http://${base}/api/pins/${s.pin}`);
      expect(r.status).toBe(200);
    }
    for (let i = 0; i < 10; i++) expect((await fetch(`http://${base}/api/pins/000000`)).status).toBe(404);
    expect((await fetch(`http://${base}/api/pins/${s.pin}`)).status).toBe(429);
  });
});
