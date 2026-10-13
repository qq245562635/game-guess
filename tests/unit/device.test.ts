import assert from "node:assert/strict";
import { test } from "node:test";
import { issueDeviceToken, verifyDeviceToken } from "@/server/session/device";

const KEY = "k".repeat(32);

test("issued token verifies; tampering fails", () => {
  const { deviceId, token } = issueDeviceToken(KEY);
  assert.equal(verifyDeviceToken(token, KEY), deviceId);
  const otherId = "22222222-2222-4222-8222-222222222222";
  assert.equal(verifyDeviceToken(`${otherId}.${token.split(".")[1]}`, KEY), null);
  assert.equal(verifyDeviceToken(token, "x".repeat(32)), null);
  assert.equal(verifyDeviceToken("garbage", KEY), null);
  assert.equal(verifyDeviceToken(undefined, KEY), null);
});
