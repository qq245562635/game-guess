import type { NextRequest } from "next/server";
import { nextSwitchAt } from "@/lib/date-utc";
import { getTodayState } from "@/server/game/judge";
import { repo } from "@/server/game/service";
import { ensureDevice, json, withErrors } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withErrors(async (req: NextRequest) => {
  const device = ensureDevice(req);
  const now = new Date();
  const today = await getTodayState(repo, device.deviceId, now);
  return json(
    { ...today, serverNow: now.toISOString(), nextSwitchAt: nextSwitchAt(now).toISOString() },
    { device },
  );
});
