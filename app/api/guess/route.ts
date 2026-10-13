import type { NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/origin";
import { submitGuess, type GuessStatus } from "@/server/game/judge";
import { repo } from "@/server/game/service";
import { clientIp, ensureDevice, json, withErrors } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const HTTP_STATUS: Record<GuessStatus, number> = {
  accepted: 200,
  duplicate: 200,
  invalid: 200,
  completed: 200,
  stale_puzzle: 409,
  not_found: 404,
};

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const POST = withErrors(async (req: NextRequest) => {
  // Basic CSRF defence: JSON only, and same-origin when the browser tells us the origin.
  if (!req.headers.get("content-type")?.includes("application/json")) {
    return json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const sameOrigin = isSameOrigin(req.headers.get("origin"), {
    forwardedHost: req.headers.get("x-forwarded-host"),
    host: req.headers.get("host"),
  });
  if (!sameOrigin) return json({ error: "forbidden" }, { status: 403 });

  const device = ensureDevice(req);
  if (!rateLimit(`guess:${clientIp(req)}`, 60, 60_000) || !rateLimit(`guess-d:${device.deviceId}`, 30, 60_000)) {
    return json({ error: "rate_limited" }, { status: 429, device });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, { status: 400, device });
  }
  const { puzzleNumber, gameId, clientGuessId } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof puzzleNumber !== "number" ||
    typeof gameId !== "string" ||
    typeof clientGuessId !== "string" ||
    !ID_RE.test(clientGuessId) ||
    gameId.length > 64
  ) {
    return json({ error: "bad_request" }, { status: 400, device });
  }

  const res = await submitGuess(repo, { deviceId: device.deviceId, puzzleNumber, gameId, clientGuessId, now: new Date() });
  return json(res, { status: HTTP_STATUS[res.status], device });
});
