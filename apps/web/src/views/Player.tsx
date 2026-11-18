import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { StateView } from '@squeezer/shared';
import { Wordmark } from '../brand/Brand.tsx';
import { AnswerButton } from '../game/Answer.tsx';
import { CheckIcon, CrossIcon, DashIcon, Glyph, marker } from '../game/markers.tsx';
import { NickChip } from '../game/NickChip.tsx';
import { fmt, t } from '../i18n/pl.ts';
import { checkPin } from '../lib/api.ts';
import { useCountdown } from '../lib/countdown.ts';
import { useLive, type LiveSnapshot } from '../lib/live.ts';
import { local, PLAYER_KEY, type PlayerTicket } from '../lib/storage.ts';

const TICKET_TTL = 6 * 3_600_000;

function loadTicket(): PlayerTicket | null {
  const tk = local.get<PlayerTicket>(PLAYER_KEY);
  return tk && Date.now() - tk.at < TICKET_TTL ? tk : null;
}

/** Participant app: PIN → nickname → the game, in one page. Survives refresh via the session token. */
export function Player({ initialPin }: { initialPin?: string }) {
  const ticket = useRef<PlayerTicket | null>(loadTicket());
  const [step, setStep] = useState<'pin' | 'nick' | 'game'>(ticket.current ? 'game' : 'pin');
  const [pin, setPin] = useState(initialPin ?? '');
  const live = useLive(() => (ticket.current ? { t: 'resume', token: ticket.current.token } : null));

  live.conn.onJoined = (m) => {
    ticket.current = { token: m.token, pin, nickname: m.nickname, at: Date.now() };
    local.set(PLAYER_KEY, ticket.current);
    setStep('game');
  };

  // A stale ticket (server restarted, session gone): start over.
  useEffect(() => {
    if (step === 'game' && live.error?.code === 'not_found' && !live.joined) {
      local.remove(PLAYER_KEY);
      ticket.current = null;
      live.conn.clearError();
      setStep('pin');
    }
  }, [live.error, live.joined, step, live.conn]);

  const leave = () => {
    local.remove(PLAYER_KEY);
    ticket.current = null;
    location.href = '/';
  };

  return (
    <div className="gutter mx-auto flex min-h-dvh max-w-md flex-col pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">
      {live.status === 'reconnecting' && step === 'game' && (
        <div role="status" className="mb-3 rounded-2xl bg-surface-2 px-4 py-2 text-center text-sm font-semibold text-muted">
          <span className="anim-pulse mr-2 inline-block size-2.5 rounded-full bg-pulp align-middle" />
          {t.play.reconnecting}
        </div>
      )}
      {step === 'pin' && <PinStep pin={pin} setPin={setPin} auto={!!initialPin} onOk={() => setStep('nick')} />}
      {step === 'nick' && <NickStep live={live} pin={pin} onBack={() => setStep('pin')} />}
      {step === 'game' && <Game live={live} onLeave={leave} />}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">{children}</div>;
}

function Field(props: { id: string; label: string; value: string; onChange: (v: string) => void; pinStyle?: boolean; placeholder: string; maxLength: number; inputMode?: 'numeric' }) {
  return (
    <div className="grid w-full gap-1.5 text-left">
      <label htmlFor={props.id} className="text-sm font-semibold text-muted">
        {props.label}
      </label>
      <input
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        inputMode={props.inputMode}
        autoComplete="off"
        autoFocus
        className={`w-full rounded-2xl border-2 border-line bg-surface px-4 py-3.5 font-display font-bold tracking-wide outline-none focus:border-pulp ${
          props.pinStyle ? 'tnum text-center text-[34px] tracking-[.12em]' : 'text-[22px]'
        }`}
      />
    </div>
  );
}

const Primary = ({ children, busy }: { children: ReactNode; busy?: boolean }) => (
  <button type="submit" disabled={busy} className="squish w-full rounded-[18px] bg-pulp p-4 font-display text-xl font-extrabold text-on-pulp disabled:opacity-60">
    {children}
  </button>
);

function PinStep({ pin, setPin, auto, onOk }: { pin: string; setPin: (p: string) => void; auto: boolean; onOk: () => void }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const digits = pin.replace(/\D/g, '');
  const check = async () => {
    if (digits.length !== 6) return setErr(t.join.pinShort);
    setBusy(true);
    const r = await checkPin(digits).catch(() => 'unknown' as const);
    setBusy(false);
    if (r === 'ok') {
      setPin(digits);
      onOk();
    } else setErr(r === 'limited' ? 'Za dużo prób. Odczekaj minutę i spróbuj ponownie.' : t.join.pinUnknown);
  };
  useEffect(() => {
    if (auto && digits.length === 6) void check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void check();
  };
  const shown = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)}` : digits;
  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Wordmark className="text-[26px]" />
      <h1 className="text-3xl font-extrabold tracking-tight">{t.join.title}</h1>
      <p className="text-muted">{t.join.pinHint}</p>
      <Field id="pin" label={t.join.pinLabel} value={shown} onChange={(v) => (setPin(v.replace(/\D/g, '').slice(0, 6)), setErr(''))} pinStyle placeholder="000 000" maxLength={7} inputMode="numeric" />
      <p role="alert" className="min-h-6 text-sm font-semibold text-bad">
        {err}
      </p>
      <Primary busy={busy}>{t.join.next}</Primary>
    </form>
  );
}

function NickStep({ live, pin, onBack }: { live: ReturnType<typeof useLive>; pin: string; onBack: () => void }) {
  const [nick, setNick] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (live.error) {
      setErr(live.error.message);
      setBusy(false);
    }
  }, [live.error]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = nick.trim();
    if (!v) return setErr(t.join.nickEmpty);
    live.conn.clearError();
    setErr('');
    setBusy(live.conn.send({ t: 'join', pin, nickname: v }));
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Wordmark className="text-[26px]" />
      <h1 className="text-3xl font-extrabold tracking-tight">{t.join.nickTitle}</h1>
      <p className="text-muted">{t.join.nickHint}</p>
      <Field id="nick" label={t.join.nickLabel} value={nick} onChange={(v) => (setNick(v), setErr(''))} placeholder="np. Sylwia" maxLength={16} />
      <p role="alert" className="min-h-6 text-sm font-semibold text-bad">
        {err}
      </p>
      <Primary busy={busy}>{t.join.enter}</Primary>
      <button type="button" onClick={onBack} className="text-sm font-semibold text-muted underline underline-offset-4">
        {t.join.changePin}
      </button>
    </form>
  );
}

function Game({ live, onLeave }: { live: LiveSnapshot & { conn: ReturnType<typeof useLive>['conn'] }; onLeave: () => void }) {
  const s = live.state;
  const [picked, setPicked] = useState<{ slideId: string; option: number } | null>(null);
  if (!s || !s.me) {
    return (
      <Centered>
        <Wordmark className="text-[26px]" />
        <p className="text-muted">
          <span className="anim-pulse mr-2 inline-block size-3 rounded-full bg-pulp align-middle" />
          {t.play.reconnecting}
        </p>
      </Centered>
    );
  }
  const me = s.me;
  switch (s.phase) {
    case 'lobby':
      return (
        <Centered>
          <p className="text-xs font-bold tracking-[.12em] text-pulp-ink uppercase">{t.play.youreIn}</p>
          <NickChip name={me.nickname} size="phone" />
          <h2 className="text-3xl font-extrabold tracking-tight">{t.play.watchScreen}</h2>
          <p className="text-muted">
            <span className="anim-pulse mr-2 inline-block size-3 rounded-full bg-pulp align-middle" />
            {t.play.waitingStart(s.players)}
          </p>
        </Centered>
      );
    case 'slide':
      return (
        <Centered>
          <h2 className="text-3xl font-extrabold tracking-tight">{s.slide?.kind === 'content' ? s.slide.title : ''}</h2>
          <p className="text-muted">{t.play.lookAtScreen}</p>
        </Centered>
      );
    case 'question':
      return <QuestionScreen s={s} live={live} picked={picked} setPicked={setPicked} />;
    case 'reveal':
      return <RevealScreen s={s} />;
    case 'leaderboard':
    case 'ended':
      return <RankScreen s={s} onLeave={onLeave} />;
  }
}

function QuestionScreen({ s, live, picked, setPicked }: { s: StateView; live: Parameters<typeof Game>[0]['live']; picked: { slideId: string; option: number } | null; setPicked: (p: { slideId: string; option: number }) => void }) {
  const q = s.slide?.kind === 'question' ? s.slide : null;
  const cd = useCountdown(s.closesAt, live.offset, q?.timeLimit ?? null);
  if (!q) return null;
  const mine = s.me?.answer ?? (picked?.slideId === q.id ? picked.option : null);
  const closed = live.error?.code === 'not_open' && picked?.slideId === q.id && s.me?.answer === null;
  if (closed) {
    return (
      <Centered>
        <div className="anim-pop grid size-[132px] place-items-center rounded-full bg-idle text-white">
          <DashIcon className="size-16" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight">{t.play.closed}</h2>
      </Centered>
    );
  }
  if (mine !== null) {
    const m = marker(mine);
    return (
      <Centered>
        <div className="anim-pop grid size-[132px] place-items-center rounded-full text-on-a" style={{ background: m.color }}>
          <Glyph name={m.glyph} className="size-16" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight">{t.play.saved}</h2>
        <div className="flex w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3.5 text-left">
          <span className="grid size-10 flex-none place-items-center rounded-xl text-on-a" style={{ background: m.color }}>
            <Glyph name={m.glyph} className="size-[22px]" />
          </span>
          <b className="min-w-0 break-words">
            {m.letter}: {q.options[mine]}
          </b>
        </div>
        <p className="text-muted">{t.play.answeredOf(s.answered, s.players)}</p>
      </Centered>
    );
  }
  const pick = (option: number) => {
    setPicked({ slideId: q.id, option });
    live.conn.clearError();
    live.conn.send({ t: 'answer', slideId: q.id, option });
    try {
      navigator.vibrate?.(18);
    } catch {
      /* not supported */
    }
  };
  const rows = Math.ceil(q.options.length / 2);
  return (
    <div className="flex flex-1 flex-col gap-4 py-2">
      <div className="tnum flex items-center justify-between text-sm font-bold text-muted">
        <span>{t.play.question(s.questionNumber, s.questionCount)}</span>
        {cd.left !== null && <span>{cd.left} s</span>}
      </div>
      {cd.left !== null && (
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
          <i className="block h-full origin-left rounded-full bg-pulp transition-transform duration-100 ease-linear" style={{ transform: `scaleX(${cd.fraction})` }} />
        </div>
      )}
      <h2 className="font-display text-[22px] leading-tight font-bold tracking-tight">{q.text}</h2>
      <div className="grid flex-1 grid-cols-2 gap-2.5" style={{ gridTemplateRows: `repeat(${rows}, minmax(56px, 1fr))` }}>
        {q.options.map((o, i) => (
          <AnswerButton key={i} index={i} text={o} onPick={() => pick(i)} />
        ))}
      </div>
    </div>
  );
}

function RevealScreen({ s }: { s: StateView }) {
  const q = s.slide?.kind === 'question' ? s.slide : null;
  const me = s.me!;
  if (!q || !s.reveal) return null;
  const answered = me.answer !== null;
  const ok = answered && me.answer === s.reveal.correct;
  const m = marker(s.reveal.correct);
  return (
    <Centered>
      <div className={`anim-pop grid size-[132px] place-items-center rounded-full text-white ${!answered ? 'bg-idle' : ok ? 'bg-good' : 'bg-bad'}`}>
        {!answered ? <DashIcon className="size-16" /> : ok ? <CheckIcon className="size-16" /> : <CrossIcon className="size-16" />}
      </div>
      <h2 className="text-3xl font-extrabold tracking-tight">{!answered ? t.play.none : ok ? t.play.right : t.play.wrong}</h2>
      {ok ? (
        <>
          <div className="tnum font-display text-[44px] font-extrabold">+{fmt(me.gained ?? 0)}</div>
          {me.streak > 1 && <p className="text-muted">{t.play.streak(me.streak)}</p>}
        </>
      ) : (
        <div className="flex w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3.5 text-left">
          <span className="grid size-10 flex-none place-items-center rounded-xl text-on-a" style={{ background: m.color }}>
            <Glyph name={m.glyph} className="size-[22px]" />
          </span>
          <span className="min-w-0">
            <span className="text-sm text-muted">{t.play.correctWas}</span>
            <br />
            <b className="break-words">
              {m.letter}: {q.options[s.reveal.correct]}
            </b>
          </span>
        </div>
      )}
      {s.reveal.explanation && <p className="text-muted">{s.reveal.explanation}</p>}
      <p className="text-muted">{t.play.total(fmt(me.points))}</p>
    </Centered>
  );
}

function RankScreen({ s, onLeave }: { s: StateView; onLeave: () => void }) {
  const me = s.me!;
  const end = s.phase === 'ended';
  return (
    <Centered>
      <p className="text-xs font-bold tracking-[.12em] text-pulp-ink uppercase">{end ? t.play.finalResult : t.play.yourPlace}</p>
      <div className="tnum font-display text-[96px] leading-none font-extrabold tracking-tighter">#{me.rank}</div>
      <p className="text-muted">{t.play.of(s.players)}</p>
      <div className="tnum font-display text-[32px] font-extrabold">{fmt(me.points)} pkt</div>
      {end ? (
        <>
          <p className="text-muted">{t.play.correctCount(me.correct, s.questionCount)}</p>
          <p className="mt-3 text-muted">{t.play.thanks}</p>
          <button type="button" onClick={onLeave} className="squish mt-2 rounded-2xl bg-surface-2 px-5 py-3 font-bold">
            Dołącz do innej gry
          </button>
        </>
      ) : (
        <p className="text-muted">{me.rank > 1 ? t.play.gap(me.rank - 1, fmt(me.gapToNext)) : t.play.leading}</p>
      )}
    </Centered>
  );
}
