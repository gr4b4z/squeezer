import { useEffect, useRef } from 'react';
import type { LeaderRow } from '@squeezer/shared';
import { fmt } from '../i18n/pl.ts';
import { marker } from './markers.tsx';

const COLS = [
  { idx: 1, h: 300, color: 1, delay: 200 },
  { idx: 0, h: 380, color: 0, delay: 500 },
  { idx: 2, h: 240, color: 2, delay: 0 },
];

export function Podium({ rows }: { rows: LeaderRow[] }) {
  return (
    <div className="grid flex-1 grid-cols-[repeat(3,260px)] items-end justify-center gap-6">
      {COLS.map((c) => {
        const r = rows[c.idx];
        if (!r) return <div key={c.idx} />;
        return (
          <div key={r.id} className="flex flex-col items-center gap-3">
            <span className="max-w-full truncate text-center font-display text-[32px] font-extrabold">{r.nickname}</span>
            <span className="tnum text-[22px] text-st-muted">{fmt(r.points)} pkt</span>
            <div
              className="anim-rise grid w-full place-items-start justify-center rounded-t-[22px] pt-4 font-display text-[72px] font-extrabold text-on-a"
              style={{ height: c.h, background: marker(c.color).color, animationDelay: `${c.delay}ms` }}
            >
              {r.rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Juice-drop confetti, 4 s, skipped for reduced motion. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const x = cv.getContext('2d');
    if (!x) return;
    const cols = ['#FF7A2F', '#FFD23F', '#2EC4B6', '#FF6B9A', '#B49CFF', '#7BD389'];
    const P = Array.from({ length: 140 }, () => ({
      x: 640 + (Math.random() - 0.5) * 300,
      y: 380,
      vx: (Math.random() - 0.5) * 16,
      vy: -8 - Math.random() * 12,
      r: 5 + Math.random() * 7,
      c: cols[Math.floor(Math.random() * 6)]!,
      a: Math.random() * 6,
      va: (Math.random() - 0.5) * 0.3,
    }));
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      x.clearRect(0, 0, 1280, 720);
      for (const p of P) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.va;
        x.save();
        x.translate(p.x, p.y);
        x.rotate(p.a);
        x.fillStyle = p.c;
        x.beginPath();
        x.moveTo(0, -p.r);
        x.bezierCurveTo(p.r * 0.9, -p.r * 0.1, p.r * 0.7, p.r, 0, p.r);
        x.bezierCurveTo(-p.r * 0.7, p.r, -p.r * 0.9, -p.r * 0.1, 0, -p.r);
        x.fill();
        x.restore();
      }
      if (t - t0 < 4200) raf = requestAnimationFrame(step);
      else x.clearRect(0, 0, 1280, 720);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={1280} height={720} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
}
