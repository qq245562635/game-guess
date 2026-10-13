import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const DEVICE_COOKIE = "gg_d";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~400 days (browser cap)

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return s;
}

function sign(id: string, key: string): string {
  return createHmac("sha256", key).update(id).digest("base64url");
}

export function issueDeviceToken(key = secret()): { deviceId: string; token: string } {
  const deviceId = randomUUID();
  return { deviceId, token: `${deviceId}.${sign(deviceId, key)}` };
}

/** Returns the device id if the token is authentic, otherwise null. */
export function verifyDeviceToken(token: string | undefined | null, key = secret()): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(id, key));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  return /^[0-9a-f-]{36}$/.test(id) ? id : null;
}
