# Squeezer

A live quiz for a room: the presenter shows slides and questions, people answer on their phones, and the host sees who got it right in real time.

Requirements and build order: the *Live Quiz Platform — Requirements* doc. This repo is at **step 1 (design system) and step 2 (live loop, no persistence)** of the build order.

## Quick start

```bash
pnpm install
pnpm dev          # gateway on :3001, web on :5173 (proxies /api and /ws)
```

Open <http://localhost:5173/host>, pick a quiz and open the lobby. On a phone in the same network, open `http://<your-ip>:5173` and type the PIN (or scan the QR code).

| Path | What it is |
| --- | --- |
| `/` | Participant: PIN → nickname → game |
| `/join/<pin>` | Same, PIN prefilled (the lobby QR code points here) |
| `/host` | Pick a deck and session settings, open a lobby |
| `/live/<sessionId>` | Presenter screen with the host's control bar. `#p=<token>` opens it without controls, for a second screen |
| `/design` | Living design system: tokens and every game component |

Host keys on the presenter screen: <kbd>Space</kbd> / <kbd>→</kbd> next, <kbd>C</kbd> close answers, <kbd>F</kbd> full screen, <kbd>H</kbd> hide the bar.

## Layout

```
apps/gateway     Fastify: REST (/api), WebSocket (/ws), live session state machine, serves the built SPA
apps/web         React 19 + Vite + Tailwind v4 + Motion: participant, presenter, host and /design views
packages/shared  zod schemas for decks and WebSocket messages, scoring and ranking (used by both sides)
decks/           Quiz decks as JSON, validated at startup
e2e/             Playwright: full live loop with a host and two phones
scripts/         load-test.ts: simulated phones, measures state-change latency
```

## How the live loop works

- The server owns the session state. Clients render what it sends and send answers; they never change state.
- States: `lobby → slide | question → reveal → leaderboard → … → ended`. Only the host's commands (`next`, `close`, `end`) or the server timer move it.
- Every state change sends each socket the full state *as its role sees it* (`StateView`). Participants never receive the correct answer before the reveal.
- Answer time is measured on the server from the question's broadcast; the client clock is never trusted. Clients only use a ping/pong offset to draw the countdown.
- A question closes when the timer runs out, when everyone has answered, or when the host closes it.
- Reconnect: a participant keeps a session token in `localStorage`; after a refresh or network drop the server replies with the full current state and score.
- Failed PIN attempts are limited to 10 per minute per IP. Successful joins are not limited, because a whole class often shares one IP.

State is in memory for now. Step 6 (hardening) moves it to Redis so a session survives a restart and can run on several instances.

## Decks

`decks/*.json`, schema in `packages/shared/src/deck.ts`:

```json
{ "type": "single", "id": "q1", "question": "Ile bitów ma jeden bajt?", "options": ["4", "16", "8", "32"], "correct": 2, "timeLimit": 20 }
```

Content slides: `{ "type": "content", "id": "intro", "title": "…", "body": "…" }`. `timeLimit` is 10–120 s or `null` (host closes). Points default to 1000.

## Design system

Tokens live in `apps/web/src/styles/tokens.css` and are exposed as Tailwind utilities (`bg-pulp`, `text-muted`, `bg-a1`, `font-display`, `bg-st-bg` …). Change colours, fonts and motion there only. Fonts (Bricolage Grotesque, Figtree) are self-hosted through Fontsource, so no request goes to Google. `/design` shows every component in its real states.

The participant view is the main bundle (about 77 KB of JS gzipped); presenter, host and design pages load on demand.

## Checks

```bash
pnpm typecheck
pnpm test                                   # unit + WebSocket integration tests
pnpm build && pnpm e2e                      # Playwright, against the production build
pnpm start                                  # in another terminal, then:
pnpm load -- --players 100 --sessions 20    # fails if p95 state change ≥ 500 ms
```

Last local run (one machine, load generator included): 20 sessions × 100 players, state change p95 196 ms, answer ack p95 52 ms; one session × 500 players, p95 13 ms.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `PORT` / `HOST` | `3001` / `0.0.0.0` | |
| `DECKS_DIR` | `decks/` | |
| `WEB_DIST` | `apps/web/dist` | Served when it exists |
| `MAX_PARTICIPANTS` | `200` | Per session |
| `SESSION_CREATE_LIMIT` | `30` | Sessions per IP per hour (until host accounts exist) |
| `TRUST_PROXY` | `false` | Set `true` behind Caddy so rate limits see the real IP |
| `LOG_LEVEL` | `info` | JSON logs (pino) |

`Dockerfile` builds one image with the gateway and the SPA.

## Not built yet

Host accounts and login, the separate host control panel with the per-person grid (the server already sends it as `grid`), persistence and reports, the deck editor, Redis, English UI. See the build order in the requirements doc.
