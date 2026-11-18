import { useId } from 'react';

const WAVE = (y: number) =>
  `M0 ${y} Q 17.5 ${y - 8} 35 ${y} T 70 ${y} T 105 ${y} T 140 ${y} T 175 ${y} T 210 ${y} T 245 ${y} T 280 ${y} V 200 H 0 Z`;

/** Countdown as a draining glass of juice. `fraction` = time left / time limit. */
export function JuiceGlass({ fraction, label, className = 'size-40' }: { fraction: number; label: string | number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const y = 8 + (1 - Math.min(1, Math.max(0, fraction))) * 124;
  return (
    <svg className={className} viewBox="0 0 140 140" role="timer" aria-label={`Zostało ${label} s`}>
      <defs>
        <clipPath id={`g${id}`}>
          <circle cx="70" cy="70" r="60" />
        </clipPath>
      </defs>
      <circle cx="70" cy="70" r="65" fill="none" stroke="var(--sq-st-line)" strokeWidth="5" />
      <g clipPath={`url(#g${id})`}>
        <g style={{ transform: `translateY(${y.toFixed(1)}px)`, transition: 'transform 200ms linear' }}>
          <path className="glass-wave-slow" fill="#FFD23F" d={WAVE(6)} />
          <path className="glass-wave" fill="#FF7A2F" d={WAVE(10)} />
        </g>
      </g>
      <text
        x="70"
        y="70"
        textAnchor="middle"
        dominantBaseline="central"
        className="tnum font-display font-extrabold"
        style={{ fontSize: 56, fill: 'var(--sq-st-ink)', paintOrder: 'stroke', stroke: 'var(--sq-st-bg)', strokeWidth: 6 }}
      >
        {label}
      </text>
    </svg>
  );
}
