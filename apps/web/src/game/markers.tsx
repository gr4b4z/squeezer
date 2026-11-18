/** Answer markers: colour + letter + glyph, so colour is never the only cue. */
export const GLYPHS = {
  drop: 'M12 2.5C12 2.5 5 10.2 5 14.5a7 7 0 0 0 14 0C19 10.2 12 2.5 12 2.5Z',
  slice: 'M2.5 8.5h19a9.5 9.5 0 0 1-19 0Z',
  leaf: 'M4 20C4 10.5 10.5 4 20 4c0 9.5-6.5 16-16 16Z',
  spark: 'M12 2l2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z',
  ring: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Zm0 5a4 4 0 1 1 0 8a4 4 0 1 1 0-8Z',
  seed: 'M12 2c4 3 6 6.5 6 10s-2 7-6 10c-4-3-6-6.5-6-10s2-7 6-10Z',
} as const;

export type GlyphName = keyof typeof GLYPHS;

export interface Marker {
  letter: string;
  glyph: GlyphName;
  name: string;
  /** CSS colour (token) */
  color: string;
  hex: string;
}

export const MARKERS: readonly Marker[] = [
  { letter: 'A', glyph: 'drop', name: 'Tangerine', color: 'var(--sq-a1)', hex: '#FF8A3D' },
  { letter: 'B', glyph: 'slice', name: 'Lagoon', color: 'var(--sq-a2)', hex: '#2EC4B6' },
  { letter: 'C', glyph: 'leaf', name: 'Lemon', color: 'var(--sq-a3)', hex: '#FFD23F' },
  { letter: 'D', glyph: 'spark', name: 'Berry', color: 'var(--sq-a4)', hex: '#FF6B9A' },
  { letter: 'E', glyph: 'ring', name: 'Plum', color: 'var(--sq-a5)', hex: '#B49CFF' },
  { letter: 'F', glyph: 'seed', name: 'Leaf', color: 'var(--sq-a6)', hex: '#7BD389' },
];

export const marker = (i: number): Marker => MARKERS[i % MARKERS.length]!;

export function Glyph({ name, className = 'size-6' }: { name: GlyphName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d={GLYPHS[name]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** Stable colour for a nickname chip. */
export function nickColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return marker(h).color;
}

export function CheckIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function CrossIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
export function DashIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
