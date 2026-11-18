import { useEffect, useState } from 'react';
import type { SessionSettings } from '@squeezer/shared';
import { Wordmark } from '../brand/Brand.tsx';
import { t } from '../i18n/pl.ts';
import { createSession, listDecks, type DeckSummary } from '../lib/api.ts';
import { navigate } from '../lib/router.ts';
import { hostKey, session } from '../lib/storage.ts';

/** Pick a deck and open a lobby. Step 4 puts this behind host login and lists the host's own decks. */
export function HostHome() {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [deckId, setDeckId] = useState<string>('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<SessionSettings>({ showLeaderboard: true, speedScoring: false, lateJoin: true });

  useEffect(() => {
    listDecks()
      .then((d) => {
        setDecks(d);
        setDeckId(d[0]?.id ?? '');
      })
      .catch(() => setErr('Nie udało się wczytać quizów. Sprawdź, czy serwer działa, i odśwież stronę.'));
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const s = await createSession(deckId, settings);
      session.set(hostKey(s.sessionId), { hostToken: s.hostToken, presenterToken: s.presenterToken });
      navigate(`/live/${s.sessionId}`);
    } catch {
      setErr('Nie udało się otworzyć lobby. Spróbuj ponownie za chwilę.');
      setBusy(false);
    }
  };

  const toggles: [keyof SessionSettings, string][] = [
    ['showLeaderboard', t.host.showLeaderboard],
    ['speedScoring', t.host.speedScoring],
    ['lateJoin', t.host.lateJoin],
  ];

  return (
    <div className="gutter mx-auto grid max-w-3xl gap-8 py-10">
      <Wordmark className="text-2xl" />
      <div className="grid gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">{t.host.pickDeck}</h1>
        <p className="text-muted">{t.host.pickHint}</p>
      </div>
      {err && (
        <p role="alert" className="rounded-2xl bg-bad-bg px-4 py-3 font-semibold text-bad">
          {err}
        </p>
      )}
      <div role="radiogroup" aria-label={t.host.pickDeck} className="grid gap-3">
        {decks?.map((d) => (
          <label
            key={d.id}
            className={`squish flex cursor-pointer items-start gap-4 rounded-2xl border-2 bg-surface p-5 ${deckId === d.id ? 'border-pulp' : 'border-line'}`}
          >
            <input type="radio" name="deck" value={d.id} checked={deckId === d.id} onChange={() => setDeckId(d.id)} className="mt-1.5 size-5 accent-[var(--sq-pulp)]" />
            <span className="grid gap-1">
              <b className="font-display text-xl">{d.title}</b>
              {d.description && <span className="text-muted">{d.description}</span>}
              <span className="text-sm text-muted">{t.host.slides(d.slides, d.questions)}</span>
            </span>
          </label>
        ))}
      </div>
      <fieldset className="grid gap-3 rounded-2xl border border-line bg-surface p-5">
        <legend className="px-1 text-xs font-bold tracking-widest text-muted uppercase">{t.host.settings}</legend>
        {toggles.map(([k, label]) => (
          <label key={k} className="flex items-center justify-between gap-4">
            <span className="font-semibold">{label}</span>
            <input
              type="checkbox"
              checked={settings[k]}
              onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.checked }))}
              className="size-6 accent-[var(--sq-pulp)]"
            />
          </label>
        ))}
      </fieldset>
      <button type="button" disabled={!deckId || busy} onClick={start} className="squish justify-self-start rounded-full bg-pulp px-7 py-4 text-lg font-bold text-on-pulp disabled:opacity-50">
        {t.host.start} →
      </button>
    </div>
  );
}
