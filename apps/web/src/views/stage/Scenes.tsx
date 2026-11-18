import type { ReactNode } from 'react';
import type { StateView } from '@squeezer/shared';
import { Wordmark } from '../../brand/Brand.tsx';
import { OptionTile } from '../../game/Answer.tsx';
import { JuiceGlass } from '../../game/JuiceGlass.tsx';
import { Leaderboard } from '../../game/Leaderboard.tsx';
import { NickChip } from '../../game/NickChip.tsx';
import { Confetti, Podium } from '../../game/Podium.tsx';
import { QrCode } from '../../game/QrCode.tsx';
import { RevealBars } from '../../game/RevealBars.tsx';
import { t } from '../../i18n/pl.ts';
import { useCountdown } from '../../lib/countdown.ts';

const Pill = ({ children, id }: { children: ReactNode; id?: string }) => (
  <span id={id} className="tnum rounded-full border border-st-line bg-st-surface px-[18px] py-2 text-st-ink">
    {children}
  </span>
);

function Top({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-5 text-[22px] font-semibold text-st-muted">
      {left}
      {right}
    </div>
  );
}

const Brand = () => <Wordmark className="text-[26px] text-st-ink" eeClass="text-pulp" />;

export function Scene({ s, offset }: { s: StateView; offset: number }) {
  switch (s.phase) {
    case 'lobby':
      return <Lobby s={s} />;
    case 'slide':
      return <ContentScene s={s} />;
    case 'question':
      return <QuestionScene s={s} offset={offset} />;
    case 'reveal':
      return <RevealScene s={s} />;
    case 'leaderboard':
      return (
        <>
          <Top left={<Brand />} right={<Pill>{t.stage.after(s.questionNumber, s.questionCount)}</Pill>} />
          <div className="mt-7 grid content-start gap-3">
            <h2 className="mb-3 text-5xl font-extrabold tracking-tight">{t.stage.ranking}</h2>
            <Leaderboard rows={s.leaderboard ?? []} />
          </div>
        </>
      );
    case 'ended':
      return (
        <>
          <Top left={<Brand />} right={<Pill>{t.stage.end(s.players)}</Pill>} />
          <div className="mt-5 flex flex-1 flex-col">
            <Podium rows={s.leaderboard ?? []} />
          </div>
          <Confetti />
        </>
      );
  }
}

function Lobby({ s }: { s: StateView }) {
  const url = `${location.origin}/join/${s.pin}`;
  const names = s.lobby ?? [];
  return (
    <>
      <Top left={<Brand />} right={<Pill>{s.deckTitle}</Pill>} />
      <div className="mt-4 grid flex-1 grid-cols-[520px_1fr] items-center gap-14">
        <div className="grid gap-3.5">
          <div className="text-2xl font-semibold text-st-muted">
            {t.stage.joinAt} <b className="text-st-ink">{location.host}</b> {t.stage.andPin}
          </div>
          <div className="tnum font-display text-[124px] leading-[.95] font-extrabold tracking-tight" aria-label={`PIN ${s.pin}`}>
            {s.pin.slice(0, 3)} {s.pin.slice(3)}
          </div>
          <div className="mt-3 flex items-center gap-5">
            <QrCode text={url} />
            <p className="max-w-[16ch] text-xl text-st-muted">{t.stage.orScan}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4 self-stretch">
          <div className="flex items-baseline gap-3.5">
            <b className="tnum font-display text-[64px] leading-none font-extrabold">{names.length}</b>
            <span className="text-2xl text-st-muted">{t.stage.inLobby(names.length)}</span>
          </div>
          <div className="flex max-h-[430px] flex-wrap content-start gap-3 overflow-hidden">
            {names.slice(-60).map((n) => (
              <NickChip key={n} name={n} />
            ))}
          </div>
          <div className="mt-auto text-xl text-st-muted">{t.stage.waitHost}</div>
        </div>
      </div>
    </>
  );
}

function ContentScene({ s }: { s: StateView }) {
  if (s.slide?.kind !== 'content') return null;
  return (
    <>
      <Top left={<Brand />} right={<Pill>{s.deckTitle}</Pill>} />
      <div className="flex flex-1 flex-col justify-center gap-6 pr-24">
        <h2 className="text-[72px] font-extrabold tracking-tight">{s.slide.title}</h2>
        {s.slide.body && <p className="max-w-[40ch] text-[30px] leading-snug text-st-muted">{s.slide.body}</p>}
      </div>
    </>
  );
}

function QuestionScene({ s, offset }: { s: StateView; offset: number }) {
  const q = s.slide?.kind === 'question' ? s.slide : null;
  const cd = useCountdown(s.closesAt, offset, q?.timeLimit ?? null);
  if (!q) return null;
  const cols = q.options.length > 4 ? 3 : 2;
  return (
    <>
      <Top left={<Pill>{t.stage.question(s.questionNumber, s.questionCount)}</Pill>} right={<Pill>{t.stage.answers(s.answered, s.players)}</Pill>} />
      <div className="mt-5 grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-7">
        <div className="grid grid-cols-[1fr_168px] items-center gap-8">
          <h2 className="text-[60px] leading-[1.05] font-bold tracking-tight">{q.text}</h2>
          {cd.left !== null && <JuiceGlass fraction={cd.fraction} label={cd.left} className="size-[168px]" />}
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {q.options.map((o, i) => (
            <OptionTile key={i} index={i} text={o} compact={cols === 3} />
          ))}
        </div>
      </div>
    </>
  );
}

function RevealScene({ s }: { s: StateView }) {
  const q = s.slide?.kind === 'question' ? s.slide : null;
  if (!q || !s.reveal) return null;
  const r = s.reveal;
  return (
    <>
      <Top left={<Pill>{t.stage.question(s.questionNumber, s.questionCount)}</Pill>} right={<Pill>{t.stage.pctCorrect(r.pctCorrect)}</Pill>} />
      <div className="mt-5 grid flex-1 grid-rows-[auto_1fr_auto] gap-5">
        <h2 className="text-[40px] leading-[1.05] font-bold tracking-tight">{q.text}</h2>
        <RevealBars counts={r.counts} correct={r.correct} />
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${q.options.length}, minmax(0, 1fr))` }}>
          {q.options.map((o, i) => (
            <OptionTile key={i} index={i} text={o} compact state={i === r.correct ? 'win' : 'dim'} />
          ))}
        </div>
        {r.explanation && <p className="text-2xl text-st-muted">{r.explanation}</p>}
      </div>
    </>
  );
}
