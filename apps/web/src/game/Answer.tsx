import { CheckIcon, Glyph, marker } from './markers.tsx';

/** Participant answer button: fills its grid cell, squeezes on press. */
export function AnswerButton({ index, text, onPick, disabled }: { index: number; text: string; onPick: () => void; disabled?: boolean }) {
  const m = marker(index);
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-label={`${m.letter}: ${text}`}
      className="squish flex min-h-14 flex-col items-start justify-between rounded-3xl p-4 text-left font-display text-xl leading-tight font-bold text-on-a disabled:opacity-50"
      style={{ background: m.color }}
    >
      <span className="flex items-center gap-1.5 text-[26px] font-extrabold">
        <Glyph name={m.glyph} className="size-[26px]" />
        {m.letter}
      </span>
      <span className="break-words">{text}</span>
    </button>
  );
}

/** Presenter option tile. `state` dims or highlights it on the reveal. */
export function OptionTile({ index, text, state = 'plain', compact }: { index: number; text: string; state?: 'plain' | 'win' | 'dim'; compact?: boolean }) {
  const m = marker(index);
  return (
    <div
      className={`relative flex items-center gap-4 rounded-[22px] font-display font-bold text-on-a transition-[opacity,transform] duration-300 ease-spring ${
        compact ? 'min-h-[88px] px-5 py-4 text-[28px]' : 'min-h-[104px] px-6 py-5 text-[34px]'
      } ${state === 'dim' ? 'scale-[.97] opacity-30' : ''} ${state === 'win' ? 'scale-[1.02]' : ''}`}
      style={{ background: m.color }}
    >
      <span className="flex flex-none items-center gap-1.5 font-extrabold">
        <Glyph name={m.glyph} className="size-[30px]" />
        {m.letter}
      </span>
      <span className="min-w-0 hyphens-auto [overflow-wrap:anywhere]" lang="pl">
        {text}
      </span>
      {state === 'win' && (
        <span className="anim-pop absolute -top-3 -right-3 grid size-11 place-items-center rounded-full bg-on-a text-white ring-4 ring-st-bg">
          <CheckIcon className="size-[26px]" />
        </span>
      )}
    </div>
  );
}
