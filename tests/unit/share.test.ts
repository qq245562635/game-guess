import assert from "node:assert/strict";
import { test } from "node:test";
import { buildShareText } from "@/lib/share";
import { submitGuess } from "@/server/game/judge";
import { DEVICE, NOW, TODAY, WRONG, cid, makeRepo } from "../helpers";

test("share text: score, grid, streak, url and no spoilers", async () => {
  const repo = makeRepo();
  for (const slug of [WRONG[0], WRONG[1], "hollow-knight"]) {
    await submitGuess(repo, { deviceId: DEVICE, puzzleNumber: TODAY, gameId: slug, clientGuessId: cid(), now: NOW });
  }
  const state = (await repo.getSession(DEVICE, `p${TODAY}`))!;
  const rows = state.guesses.map((g) => g.row);
  const text = buildShareText({ puzzleNumber: TODAY, outcome: "WON", rows, url: "https://example.com", streak: 7 });
  const lines = text.split("\n");
  assert.equal(lines[0], `GameGuess #${TODAY} 3/6`);
  assert.equal(lines.length, 1 + 3 + 2);
  assert.equal(lines[3], "🟩".repeat(6));
  assert.equal(lines[4], "Streak: 7");
  assert.equal(lines[5], "https://example.com");
  for (const banned of ["Hollow", "Knight", "Team Cherry", "2017", "Metroidvania"]) {
    assert.ok(!text.includes(banned), `share text leaks "${banned}"`);
  }
});

test("share text: loss shows X/6, archive hides streak", () => {
  const text = buildShareText({ puzzleNumber: 5, outcome: "LOST", rows: [], url: "u", streak: 3, archive: true });
  assert.ok(text.startsWith("GameGuess #5 (Archive) X/6"));
  assert.ok(!text.includes("Streak"));
});
