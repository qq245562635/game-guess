import assert from "node:assert/strict";
import { test } from "node:test";
import { compareGames } from "@/lib/compare";
import { SEED_GAMES, toAttrs, validateSeed } from "@/server/content/seed-data";

test("seed data passes vocabulary and alias validation", () => {
  assert.deepEqual(validateSeed(SEED_GAMES), []);
});

test("no two seed games are indistinguishable by feedback", () => {
  // If all six cells match for two different games, players cannot tell them apart.
  const attrs = SEED_GAMES.map((g) => toAttrs(g));
  const clashes: string[] = [];
  for (const a of attrs) {
    for (const b of attrs) {
      if (a.id < b.id && compareGames(a, b).every((c) => c.result === "exact")) clashes.push(`${a.id} ~ ${b.id}`);
    }
  }
  assert.deepEqual(clashes, []);
});
