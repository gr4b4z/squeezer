import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type { HostCommand } from '@squeezer/shared';
import { Wordmark } from '../brand/Brand.tsx';
import { Stage } from '../game/Stage.tsx';
import { t } from '../i18n/pl.ts';
import { useLive } from '../lib/live.ts';
import { hostKey, session } from '../lib/storage.ts';
import { Scene } from './stage/Scenes.tsx';

function readAccess(sessionId: string): { role: 'host' | 'presenter'; token: string } | null {
  const hash = new URLSearchParams(location.hash.slice(1));
  const p = hash.get('p');
  if (p) return { role: 'presenter', token: p };
  const h = session.get<{ hostToken: string; presenterToken: string }>(hostKey(sessionId));
  return h ? { role: 'host', token: h.hostToken } : null;
}

/** Presenter screen. With the host token it also carries the host's control bar (step 2 moves controls to their own panel). */
export function Present({ sessionId }: { sessionId: string }) {
  const [access] = useState(() => readAccess(sessionId));
  const live = useLive(() => (access ? { t: 'hello', role: access.role, sessionId, token: access.token } : null));
  const [barHidden, setBarHidden] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [copied, setCopied] = useState(false);
  const s = live.state;
  const isHost = access?.role === 'host';

  const cmd = (c: HostCommand) => live.conn.send({ t: 'host', cmd: c });

  useEffect(() => {
    if (!isHost) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, button')) return;
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        cmd('next');
      } else if (e.key === 'c' || e.key === 'C') cmd('close');
      else if (e.key === 'h' || e.key === 'H') setBarHidden((v) => !v);
      else if (e.key === 'f' || e.key === 'F') void toggleFullscreen();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (!access || live.error?.code === 'unauthorized') {
    return (
      <div className="gutter grid min-h-dvh place-items-center bg-st-bg text-center text-st-ink">
        <div className="grid justify-items-center gap-4">
          <Wordmark className="text-3xl" eeClass="text-pulp" />
          <p className="text-st-muted">{t.host.noAccess}</p>
          <a href="/host" className="squish rounded-2xl bg-pulp px-5 py-3 font-bold text-on-pulp">
            {t.host.newSession}
          </a>
        </div>
      </div>
    );
  }

  const copyPresenterLink = async () => {
    const h = session.get<{ presenterToken: string }>(hostKey(sessionId));
    if (!h) return;
    const link = `${location.origin}/live/${sessionId}#p=${h.presenterToken}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt(t.host.copyLink, link);
    }
  };

  const nextLabel = s ? t.host.next[s.phase] : '…';
  const stateLabel = s
    ? s.phase === 'lobby'
      ? `Lobby · PIN ${s.pin} · ${s.players}`
      : s.phase === 'question'
        ? `${t.stage.question(s.questionNumber, s.questionCount)} · ${s.answered}/${s.players}`
        : `${s.slideIndex + 1}/${s.slideCount} · ${s.deckTitle}`
    : '';

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex h-dvh flex-col bg-st-bg">
      <div className="relative min-h-0 flex-1">
        <Stage>
          <AnimatePresence mode="wait">
            {s && (
              <motion.div
                key={`${s.phase}-${s.slideIndex}`}
                initial={{ opacity: 0, y: 14, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.26, ease: [0.2, 0.7, 0.2, 1] }}
                className="absolute inset-0 flex flex-col px-16 py-12"
              >
                <Scene s={s} offset={live.offset} />
              </motion.div>
            )}
          </AnimatePresence>
        </Stage>
        {live.status !== 'open' && (
          <div role="status" className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-st-surface px-4 py-2 text-sm font-semibold text-st-ink">
            {t.play.reconnecting}
          </div>
        )}
      </div>

      {isHost && !barHidden && (
        <div className="gutter border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] text-ink">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 py-3">
            <div className="grid min-w-0 flex-1 leading-tight">
              <small className="text-xs font-bold tracking-widest text-muted uppercase">{t.host.controls}</small>
              <span className="truncate font-semibold">{stateLabel}</span>
            </div>
            <span className="hidden text-xs text-muted lg:inline">{t.host.keys}</span>
            <button type="button" onClick={copyPresenterLink} className="squish rounded-xl bg-surface-2 px-4 py-3 text-sm font-bold">
              {copied ? t.host.copied : t.host.copyLink}
            </button>
            <button type="button" onClick={() => void toggleFullscreen()} className="squish hidden rounded-xl bg-surface-2 px-4 py-3 text-sm font-bold sm:block">
              {t.host.fullscreen}
            </button>
            {s?.phase !== 'ended' &&
              (confirmEnd ? (
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{t.host.endConfirm}</span>
                  <button type="button" onClick={() => (cmd('end'), setConfirmEnd(false))} className="squish rounded-xl bg-bad px-4 py-3 text-sm font-bold text-white">
                    {t.host.endYes}
                  </button>
                  <button type="button" onClick={() => setConfirmEnd(false)} className="squish rounded-xl bg-surface-2 px-4 py-3 text-sm font-bold">
                    {t.host.cancel}
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmEnd(true)} className="squish rounded-xl bg-surface-2 px-4 py-3 text-sm font-bold">
                  {t.host.end}
                </button>
              ))}
            <button
              type="button"
              onClick={() => cmd('next')}
              disabled={!s || s.phase === 'ended'}
              className="squish min-w-44 rounded-xl bg-pulp px-5 py-3 font-bold text-on-pulp disabled:opacity-50"
            >
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </div>
    </MotionConfig>
  );
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    /* not available */
  }
}
