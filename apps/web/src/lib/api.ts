import type { SessionSettings } from '@squeezer/shared';

export interface DeckSummary {
  id: string;
  title: string;
  description: string;
  slides: number;
  questions: number;
}

export async function listDecks(): Promise<DeckSummary[]> {
  const r = await fetch('/api/decks');
  if (!r.ok) throw new Error(`decks ${r.status}`);
  return r.json();
}

export async function createSession(deckId: string, settings: Partial<SessionSettings>) {
  const r = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deckId, settings }),
  });
  if (!r.ok) throw new Error(`create ${r.status}`);
  return (await r.json()) as { sessionId: string; pin: string; hostToken: string; presenterToken: string };
}

export async function checkPin(pin: string): Promise<'ok' | 'unknown' | 'limited'> {
  const r = await fetch(`/api/pins/${encodeURIComponent(pin)}`);
  if (r.status === 429) return 'limited';
  return r.ok ? 'ok' : 'unknown';
}
