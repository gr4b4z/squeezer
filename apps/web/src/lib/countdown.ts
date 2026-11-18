import { useEffect, useState } from 'react';

/** Seconds left until `closesAt` (server clock), updated 10×/s. The server still decides when answers close. */
export function useCountdown(closesAt: number | null, offset: number, limitSec: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (closesAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [closesAt]);
  if (closesAt === null || limitSec === null) return { left: null, fraction: 1 };
  const leftMs = Math.max(0, closesAt - (now + offset));
  return { left: Math.ceil(leftMs / 1000), fraction: leftMs / (limitSec * 1000) };
}
