import { nickColor } from './markers.tsx';

export function NickChip({ name, you, size = 'stage' }: { name: string; you?: boolean; size?: 'stage' | 'phone' }) {
  return (
    <span
      className={`anim-pop inline-block font-display font-bold text-on-a ${
        size === 'stage' ? 'rounded-[14px] px-[18px] py-2.5 text-2xl' : 'rounded-[18px] px-[22px] py-3 text-[28px] font-extrabold'
      } ${you ? 'outline-3 outline-offset-3 outline-st-ink' : ''}`}
      style={{ background: nickColor(name) }}
    >
      {name}
    </span>
  );
}
