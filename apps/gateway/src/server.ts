import { existsSync } from 'node:fs';
import Fastify, { type FastifyServerOptions } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { z } from 'zod';
import { PinSchema, type Deck } from '@squeezer/shared';
import { RateLimiter } from './ratelimit.ts';
import { SessionStore } from './store.ts';
import { registerWs } from './ws.ts';

export interface ServerOptions {
  decks: Map<string, Deck>;
  /** Built SPA to serve; skipped when the folder does not exist (dev uses Vite). */
  webDist?: string;
  maxParticipants?: number;
  logger?: FastifyServerOptions['logger'];
  trustProxy?: boolean;
  sweepIntervalMs?: number;
  /** Sessions one IP may create per hour. */
  createLimitPerHour?: number;
}

const CreateSessionBody = z.object({
  deckId: z.string().min(1).max(64),
  settings: z
    .object({ showLeaderboard: z.boolean(), speedScoring: z.boolean(), lateJoin: z.boolean() })
    .partial()
    .optional(),
});

export async function buildServer(o: ServerOptions) {
  const app = Fastify({ logger: o.logger ?? false, trustProxy: o.trustProxy ?? false, bodyLimit: 64 * 1024 });
  const store = new SessionStore({ maxParticipants: o.maxParticipants ?? 200 });
  const pinLimiter = new RateLimiter(10, 60_000);
  const createLimiter = new RateLimiter(o.createLimitPerHour ?? 30, 3_600_000);

  await app.register(fastifyWebsocket, { options: { maxPayload: 8 * 1024 } });
  registerWs(app, { store, pinLimiter });

  app.get('/api/health', async () => ({ ok: true, sessions: store.size }));

  app.get('/api/decks', async () =>
    [...o.decks.values()].map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      slides: d.slides.length,
      questions: d.slides.filter((s) => s.type === 'single').length,
    })),
  );

  // Step 4 (accounts) puts this behind host login; until then it is rate limited per IP.
  app.post('/api/sessions', async (req, reply) => {
    if (!createLimiter.hit(req.ip)) return reply.code(429).send({ error: 'rate_limited' });
    const body = CreateSessionBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'bad_request' });
    const deck = o.decks.get(body.data.deckId);
    if (!deck) return reply.code(404).send({ error: 'deck_not_found' });
    const { session, hostToken, presenterToken } = store.create(deck, body.data.settings ?? {});
    req.log.info({ sessionId: session.id, deck: deck.id }, 'session created');
    return reply.code(201).send({ sessionId: session.id, pin: session.pin, hostToken, presenterToken });
  });

  app.get<{ Params: { pin: string } }>('/api/pins/:pin', async (req, reply) => {
    if (pinLimiter.isBlocked(req.ip)) return reply.code(429).send({ error: 'rate_limited' });
    const s = PinSchema.safeParse(req.params.pin).success ? store.byPin(req.params.pin) : undefined;
    if (!s || (s.phase !== 'lobby' && !s.settings.lateJoin)) {
      pinLimiter.hit(req.ip);
      return reply.code(404).send({ error: 'not_found' });
    }
    return { ok: true, deckTitle: s.deck.title };
  });

  if (o.webDist && existsSync(o.webDist)) {
    await app.register(fastifyStatic, { root: o.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api') && !req.url.startsWith('/ws')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'not_found' });
    });
  }

  const sweep = setInterval(() => store.sweep(), o.sweepIntervalMs ?? 30_000);
  sweep.unref();
  app.addHook('onClose', async () => clearInterval(sweep));

  return { app, store };
}
