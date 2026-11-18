import { useEffect, useState } from 'react';
import { fmt } from '../i18n/pl.ts';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function CountUp({ from, to, delay = 250, ms = 900 }: { from: number; to: number; delay?: number; ms?: number }) {
  const [v, setV] = useState(reduced() ? to : from);
  useEffect(() => {
    if (reduced()) return setV(to);
    let raf = 0;
    const t0 = performance.now() + delay;
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms));
      setV(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay, ms]);
  return <>{fmt(v)}</>;
}
