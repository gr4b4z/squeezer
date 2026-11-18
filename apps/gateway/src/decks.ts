import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DeckSchema, type Deck } from '@squeezer/shared';

/** Loads every *.json deck in a directory and validates it. Invalid decks fail loudly at startup. */
export async function loadDecks(dir: string): Promise<Map<string, Deck>> {
  const decks = new Map<string, Deck>();
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()) {
    const raw: unknown = JSON.parse(await readFile(join(dir, file), 'utf8'));
    const res = DeckSchema.safeParse(raw);
    if (!res.success) throw new Error(`Invalid deck ${file}: ${res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    if (decks.has(res.data.id)) throw new Error(`Duplicate deck id "${res.data.id}" in ${file}`);
    decks.set(res.data.id, res.data);
  }
  return decks;
}
