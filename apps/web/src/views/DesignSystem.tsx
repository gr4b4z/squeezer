import { useEffect, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import type { LeaderRow } from '@squeezer/shared';
import { DropMark, Wordmark } from '../brand/Brand.tsx';
import { AnswerButton, OptionTile } from '../game/Answer.tsx';
import { JuiceGlass } from '../game/JuiceGlass.tsx';
import { Leaderboard } from '../game/Leaderboard.tsx';
import { Glyph, MARKERS } from '../game/markers.tsx';
import { NickChip } from '../game/NickChip.tsx';
import { RevealBars } from '../game/RevealBars.tsx';
import { Stage } from '../game/Stage.tsx';
import { t } from '../i18n/pl.ts';

/** Living reference of the design system: tokens and every game component in its real states. */
export function DesignSystem() {
  const [tick, setTick] = useState(20);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => (v <= 0 ? 20 : v - 1)), 450);
    return () => clearInterval(id);
  }, []);
  const rows: LeaderRow[] = [
    { id: '1', nickname: 'Kasia', rank: 1, points: 3000, gained: 1000 },
    { id: '2', nickname: 'Bartek', rank: 2, points: 2000, gained: 0 },
    { id: '3', nickname: 'Ola', rank: 3, points: 2000, gained: 1000 },
    { id: '4', nickname: 'Igor', rank: 4, points: 1000, gained: 0 },
  ];
  return (
    <MotionConfig reducedMotion="user">
    <div className="gutter mx-auto grid max-w-6xl gap-16 py-10">
      <header className="grid gap-3">
        <p className="text-xs font-bold tracking-[.12em] text-pulp-ink uppercase">Design system · v1</p>
        <h1 className="text-6xl font-extrabold tracking-tighter sm:text-8xl">
          squ<span className="wordmark-ee text-pulp-ink">ee</span>zer
        </h1>
        <p className="font-display text-2xl font-semibold">{t.tagline}</p>
        <p className="max-w-[60ch] text-muted">
          Tokeny są w <code>apps/web/src/styles/tokens.css</code> i działają jako klasy Tailwinda (<code>bg-pulp</code>, <code>text-muted</code>, <code>font-display</code>).
          Komponenty poniżej to te same, których używa gra.
        </p>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-center gap-8">
          <Wordmark className="text-4xl" />
          <span className="rounded-2xl bg-st-bg px-6 py-4">
            <Wordmark className="text-4xl text-st-ink" eeClass="text-pulp" />
          </span>
          <DropMark className="size-16" />
        </div>
      </Section>

      <Section title="Kolory">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Pith', '#0F1A19', 'Tło ekranu prezentera'],
            ['Peel', '#F2F5F4', 'Tło jasne'],
            ['Pulp', '#FF7A2F', 'Akcent, czas, główne akcje'],
            ['Ink', '#14201E', 'Tekst'],
          ].map(([n, hex, role]) => (
            <div key={n} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="h-24" style={{ background: hex }} />
              <div className="grid gap-0.5 px-3.5 py-3">
                <b className="font-display text-lg">{n}</b>
                <code className="tnum text-sm text-muted">{hex}</code>
                <small className="text-sm text-muted">{role}</small>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Znaczniki odpowiedzi">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {MARKERS.map((m) => (
            <div key={m.letter} className="grid justify-items-start gap-2.5 rounded-2xl p-4 text-on-a" style={{ background: m.color }}>
              <span className="flex items-center gap-2 font-display text-3xl font-extrabold">
                <Glyph name={m.glyph} className="size-7" />
                {m.letter}
              </span>
              <small className="text-sm font-semibold">
                {m.name} · {m.hex}
              </small>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Telefon: przyciski odpowiedzi">
        <div className="grid max-w-sm grid-cols-2 grid-rows-[repeat(2,140px)] gap-2.5">
          {['Wenus', 'Merkury', 'Mars', 'Ziemia'].map((o, i) => (
            <AnswerButton key={o} index={i} text={o} onPick={() => navigator.vibrate?.(18)} />
          ))}
        </div>
      </Section>

      <Section title="Ekran prezentera">
        <div className="grid gap-4 lg:grid-cols-2">
          <Frame>
            <div className="absolute inset-0 flex flex-col gap-8 px-16 py-12">
              <div className="grid grid-cols-[1fr_168px] items-center gap-8">
                <h2 className="text-[60px] leading-[1.05] font-bold tracking-tight">Która planeta jest najbliżej Słońca?</h2>
                <JuiceGlass fraction={tick / 20} label={tick} className="size-[168px]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {['Wenus', 'Merkury', 'Mars', 'Ziemia'].map((o, i) => (
                  <OptionTile key={o} index={i} text={o} />
                ))}
              </div>
            </div>
          </Frame>
          <Frame>
            <div key={replay} className="absolute inset-0 flex flex-col justify-center gap-6 px-16 py-12">
              <RevealBars counts={[3, 17, 1, 4]} correct={1} />
              <div className="grid grid-cols-4 gap-4">
                {['Wenus', 'Merkury', 'Mars', 'Ziemia'].map((o, i) => (
                  <OptionTile key={o} index={i} text={o} compact state={i === 1 ? 'win' : 'dim'} />
                ))}
              </div>
            </div>
          </Frame>
          <Frame>
            <div key={replay} className="absolute inset-0 px-16 py-12">
              <Leaderboard rows={rows} />
            </div>
          </Frame>
          <Frame>
            <div key={replay} className="absolute inset-0 flex flex-wrap content-center gap-3 px-16">
              {['Ania', 'Bartek', 'Kasia', 'Michał', 'Ola', 'Piotr', 'Zosia', 'Kuba', 'Ewa', 'Tomek', 'Marta', 'Igor'].map((n) => (
                <NickChip key={n} name={n} you={n === 'Ola'} />
              ))}
            </div>
          </Frame>
        </div>
        <button type="button" onClick={() => setReplay((v) => v + 1)} className="squish justify-self-start rounded-xl bg-surface-2 px-4 py-3 font-bold">
          Odtwórz animacje
        </button>
      </Section>

      <Section title="Ruch">
        <p className="max-w-[64ch] text-muted">
          Nacisk 120 ms (przycisk ugina się szerzej i niżej), zmiana stanu 260 ms, odsłonięcie wyniku 900 ms na sprężynie. Wszystko wyłącza się przy ustawieniu „ogranicz
          ruch”.
        </p>
      </Section>
    </div>
    </MotionConfig>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-5">
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

const Frame = ({ children }: { children: ReactNode }) => (
  <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-xl">
    <Stage>{children}</Stage>
  </div>
);
