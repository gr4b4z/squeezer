import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** A fixed 1280×720 canvas scaled to fit its box, letterboxed. Everything inside is laid out in stage pixels. */
export function Stage({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / 1280, el.clientHeight / 720)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative grid size-full place-items-center overflow-hidden bg-st-bg">
      <div
        className="relative overflow-hidden bg-st-bg text-st-ink"
        style={{ width: 1280, height: 720, transform: `scale(${scale})`, flex: 'none' }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[20%]"
          style={{
            background:
              'radial-gradient(40% 50% at 85% 10%, rgb(255 122 47 / .16), transparent 70%), radial-gradient(40% 50% at 10% 100%, rgb(46 196 182 / .12), transparent 70%)',
          }}
        />
        {children}
      </div>
    </div>
  );
}

