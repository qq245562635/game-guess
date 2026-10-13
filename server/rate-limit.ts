/**
 * Fixed-window in-memory limiter. Good enough for a single instance in M1;
 * replaced by a shared store (e.g. Upstash Redis) before launch (M5).
 */
const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 50_000) {
      for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    }
    return true;
  }
  w.count++;
  return w.count <= limit;
}
