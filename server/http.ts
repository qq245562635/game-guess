import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { diagnose } from "./diagnose";
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, issueDeviceToken, verifyDeviceToken } from "./session/device";

export interface DeviceContext {
  deviceId: string;
  /** Set when a new cookie must be written on the response. */
  newToken?: string;
}

export function readDevice(req: NextRequest): string | null {
  return verifyDeviceToken(req.cookies.get(DEVICE_COOKIE)?.value);
}

export function ensureDevice(req: NextRequest): DeviceContext {
  const existing = readDevice(req);
  if (existing) return { deviceId: existing };
  const { deviceId, token } = issueDeviceToken();
  return { deviceId, newToken: token };
}

export function json(body: unknown, init: { status?: number; device?: DeviceContext; cache?: string } = {}) {
  const res = NextResponse.json(body, { status: init.status ?? 200 });
  res.headers.set("Cache-Control", init.cache ?? "no-store");
  if (init.device?.newToken) {
    res.cookies.set(DEVICE_COOKIE, init.device.newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
  }
  return res;
}

/**
 * Wrap a route handler so unexpected errors become a JSON 500. In development the body
 * includes the cause and a setup hint so the page can show what to fix.
 */
export function withErrors<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[gameguess] request failed:", error);
      const body: Record<string, string> = { error: "server_error" };
      if (process.env.NODE_ENV !== "production") Object.assign(body, diagnose(error));
      return json(body, { status: 500 });
    }
  };
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
