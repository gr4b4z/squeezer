import { fileURLToPath } from 'node:url';
import { loadDecks } from './decks.ts';
import { buildServer } from './server.ts';

const root = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

const decks = await loadDecks(process.env.DECKS_DIR ?? root('decks'));
const { app } = await buildServer({
  decks,
  webDist: process.env.WEB_DIST ?? root('apps/web/dist'),
  maxParticipants: Number(process.env.MAX_PARTICIPANTS ?? 200),
  trustProxy: process.env.TRUST_PROXY === 'true',
  createLimitPerHour: Number(process.env.SESSION_CREATE_LIMIT ?? 30),
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
app.log.info({ decks: decks.size }, 'squeezer gateway ready');

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => void app.close().then(() => process.exit(0)));
}
