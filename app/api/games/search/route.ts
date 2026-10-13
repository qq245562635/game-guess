import type { NextRequest } from "next/server";
import { buildSearchIndex, searchCandidates } from "@/lib/normalize";
import { getCandidates } from "@/server/game/service";
import { clientIp, json } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/** Fallback search; the client normally searches the cached index locally. */
export async function GET(req: NextRequest) {
  if (!rateLimit(`search:${clientIp(req)}`, 120, 60_000)) return json({ error: "rate_limited" }, { status: 429 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  const results = searchCandidates(buildSearchIndex(await getCandidates()), q, 10);
  return json(
    results.map(({ id, title, year }) => ({ id, title, year })),
    { cache: "public, max-age=300" },
  );
}
