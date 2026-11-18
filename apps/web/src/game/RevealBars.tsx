import { useEffect, useState } from 'react';
import { marker } from './markers.tsx';

/** Answer distribution; bars grow on a spring, the correct one stays bright. */
export function RevealBars({ counts, correct }: { counts: number[]; correct: number }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(1, ...counts);
  return (
    <div className="grid h-[250px] items-end gap-7 px-5" style={{ gridTemplateColumns: `repeat(${counts.length}, minmax(0, 1fr))` }}>
      {counts.map((c, i) => (
        <div key={i} className={`flex h-full flex-col items-center justify-end gap-2.5 ${i === correct ? '' : 'opacity-35'}`}>
          <span className="tnum font-display text-[40px] font-extrabold">{c}</span>
          <i
            className="block h-full w-full max-w-[150px] origin-bottom rounded-t-[18px] rounded-b-md"
            style={{
              background: marker(i).color,
              transform: `scaleY(${grown ? Math.max(0.02, c / max) : 0})`,
              transition: `transform var(--sq-t-reveal) var(--sq-spring) ${i * 80}ms`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
