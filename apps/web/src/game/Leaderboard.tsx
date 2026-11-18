import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import type { LeaderRow } from '@squeezer/shared';
import { CountUp } from './CountUp.tsx';

/**
 * Top rows. Rendered first in the order before the last question, then re-ordered,
 * so players see who overtook whom (FLIP via motion's layout animation).
 */
export function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  const before = [...rows].sort((a, b) => b.points - b.gained - (a.points - a.gained) || a.rank - b.rank);
  const [order, setOrder] = useState(before);
  useEffect(() => {
    const id = setTimeout(() => setOrder(rows), 450);
    return () => clearTimeout(id);
  }, [rows]);
  return (
    <ol className="grid gap-3">
      {order.map((r, i) => (
        <motion.li
          key={r.id}
          layout
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className={`grid h-[72px] grid-cols-[72px_1fr_auto_auto] items-center gap-4 rounded-[18px] border px-6 text-[28px] ${
            i === 0 ? 'border-pulp/50 bg-[linear-gradient(90deg,rgb(255_122_47/.28),var(--sq-st-surface)_70%)]' : 'border-st-line bg-st-surface'
          }`}
        >
          <span className={`tnum font-display text-[32px] font-extrabold ${i === 0 ? 'text-pulp' : 'text-st-muted'}`}>{rows.find((x) => x.id === r.id)?.rank}</span>
          <span className="truncate font-display font-bold">{r.nickname}</span>
          <span className={`tnum rounded-full px-3 py-1 text-lg font-bold ${r.gained ? 'bg-a6 text-on-a' : 'bg-st-line text-st-muted'}`}>+{r.gained}</span>
          <span className="tnum font-display font-extrabold">
            <CountUp from={r.points - r.gained} to={r.points} />
          </span>
        </motion.li>
      ))}
    </ol>
  );
}
