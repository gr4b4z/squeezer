/** Fixed-window counter per key, e.g. PIN attempts per IP. */
export class RateLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit; false when the key is over its limit. */
  hit(key: string): boolean {
    const now = this.now();
    const e = this.hits.get(key);
    if (!e || now - e.start >= this.windowMs) {
      this.hits.set(key, { start: now, count: 1 });
      if (this.hits.size > 50_000) this.prune(now);
      return true;
    }
    e.count++;
    return e.count <= this.limit;
  }

  /** True when the key is over its limit, without recording a hit. */
  isBlocked(key: string): boolean {
    const e = this.hits.get(key);
    return !!e && this.now() - e.start < this.windowMs && e.count >= this.limit;
  }

  private prune(now: number): void {
    for (const [k, e] of this.hits) if (now - e.start >= this.windowMs) this.hits.delete(k);
  }
}
