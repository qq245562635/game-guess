import assert from "node:assert/strict";
import { test } from "node:test";
import { isSameOrigin } from "@/lib/origin";

test("direct request: Origin matches Host", () => {
  assert.equal(isSameOrigin("http://localhost:3000", { host: "localhost:3000" }), true);
});

test("behind a proxy: Origin matches X-Forwarded-Host", () => {
  const origin = "https://abc-3000.app.github.dev";
  assert.equal(isSameOrigin(origin, { forwardedHost: "abc-3000.app.github.dev", host: "localhost:3000" }), true);
  assert.equal(isSameOrigin(origin, { forwardedHost: "ABC-3000.app.github.dev, internal", host: "x" }), true);
});

test("cross-site and malformed origins are rejected", () => {
  assert.equal(isSameOrigin("https://evil.example", { forwardedHost: "game.example", host: "localhost:3000" }), false);
  assert.equal(isSameOrigin("not a url", { host: "localhost:3000" }), false);
  assert.equal(isSameOrigin("https://game.example", {}), false);
});

test("missing Origin is allowed (JSON content-type is still required)", () => {
  assert.equal(isSameOrigin(null, { host: "localhost:3000" }), true);
});
