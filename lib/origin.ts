/**
 * Same-origin check for state-changing requests. Behind a proxy (Codespaces, Vercel, a load
 * balancer) the public host arrives in X-Forwarded-Host while Host may be internal, so the
 * browser's Origin is compared against the forwarded host first.
 */
export function isSameOrigin(
  origin: string | null,
  headers: { forwardedHost?: string | null; host?: string | null },
): boolean {
  if (!origin) return true; // non-browser clients and some same-origin requests omit Origin
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const candidates = [headers.forwardedHost?.split(",")[0], headers.host]
    .map((h) => h?.trim().toLowerCase())
    .filter((h): h is string => !!h);
  return candidates.includes(originHost);
}
