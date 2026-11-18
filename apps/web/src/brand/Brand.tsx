/** The drop mark: a juice drop with a lemon highlight. */
export function DropMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4C24 4 9 19.5 9 29a15 15 0 0 0 30 0C39 19.5 24 4 24 4Z" fill="#FF7A2F" />
      <path d="M17 30a7 7 0 0 0 7 7" fill="none" stroke="#FFD23F" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/** Lower-case wordmark; the "ee" is squeezed. */
export function Wordmark({ className = '', eeClass = 'text-pulp-ink' }: { className?: string; eeClass?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${className}`}>
      <DropMark className="size-[1.3em]" />
      <span aria-label="Squeezer">
        squ<span className={`wordmark-ee ${eeClass}`}>ee</span>zer
      </span>
    </span>
  );
}
