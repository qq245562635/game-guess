import assert from "node:assert/strict";
import { test } from "node:test";
import { dateForPuzzleNumber } from "@/lib/date-utc";
import { getTodayState, submitGuess } from "@/server/game/judge";
import { DEVICE, NOW, TODAY, WRONG, cid, makeRepo } from "../helpers";

const guess = (repo: ReturnType<typeof makeRepo>, gameId: string, clientGuessId = cid(), puzzleNumber = TODAY) =>
  submitGuess(repo, { deviceId: DEVICE, puzzleNumber, gameId, clientGuessId, now: NOW });

test("new game: 6 attempts, no guesses, no answer", async () => {
  const res = await getTodayState(makeRepo(), DEVICE, NOW);
  assert.equal(res.available, true);
  assert.equal(res.state!.remaining, 6);
  assert.equal(res.state!.guesses.length, 0);
  assert.equal(res.state!.answer, undefined);
});

test("valid guess adds exactly one row and consumes one attempt", async () => {
  const repo = makeRepo();
  const res = await guess(repo, WRONG[0]);
  assert.equal(res.status, "accepted");
  assert.equal(res.state!.guesses.length, 1);
  assert.equal(res.state!.remaining, 5);
  assert.equal(res.state!.outcome, "IN_PROGRESS");
});

test("unknown, empty and duplicate guesses do not consume attempts", async () => {
  const repo = makeRepo();
  await guess(repo, WRONG[0]);
  assert.equal((await guess(repo, "no-such-game")).status, "invalid");
  assert.equal((await guess(repo, "")).status, "invalid");
  const dup = await guess(repo, WRONG[0]);
  assert.equal(dup.status, "duplicate");
  assert.equal(dup.state!.remaining, 5);
});

test("win ends the game immediately and reveals the answer", async () => {
  const repo = makeRepo();
  await guess(repo, WRONG[0]);
  const win = await guess(repo, "hollow-knight");
  assert.equal(win.state!.outcome, "WON");
  assert.equal(win.state!.answer!.title, "Hollow Knight");
  assert.ok(win.state!.guesses.at(-1)!.correct);
  assert.equal((await guess(repo, WRONG[1])).status, "completed");
});

test("loss after 6 wrong guesses reveals the answer", async () => {
  const repo = makeRepo();
  let last;
  for (const g of WRONG) last = await guess(repo, g);
  assert.equal(last!.state!.outcome, "LOST");
  assert.equal(last!.state!.remaining, 0);
  assert.equal(last!.state!.answer!.id, "hollow-knight");
});

test("replaying a clientGuessId is idempotent (retry after network error)", async () => {
  const repo = makeRepo();
  const id = cid();
  const a = await guess(repo, WRONG[0], id);
  const b = await guess(repo, WRONG[0], id);
  assert.equal(b.status, "accepted");
  assert.deepEqual(b.state, a.state);
  assert.equal(b.state!.remaining, 5);
});

test("concurrent submissions never double-count", async () => {
  const repo = makeRepo();
  const id = cid();
  const results = await Promise.all([guess(repo, WRONG[0], id), guess(repo, WRONG[0], id), guess(repo, WRONG[1])]);
  assert.ok(results.every((r) => r.status === "accepted"));
  const final = await getTodayState(repo, DEVICE, NOW);
  assert.equal(final.state!.guesses.length, 2);
  assert.deepEqual(
    final.state!.guesses.map((g) => g.cells.length),
    [6, 6],
  );
});

test("hints unlock after 2 and 4 wrong guesses", async () => {
  const repo = makeRepo();
  const counts: number[] = [];
  for (const g of WRONG.slice(0, 5)) counts.push((await guess(repo, g)).state!.hints.length);
  assert.deepEqual(counts, [0, 1, 1, 2, 2]);
});

test("no answer leaks before the game is over", async () => {
  const repo = makeRepo();
  const payloads = [JSON.stringify(await getTodayState(repo, DEVICE, NOW))];
  for (const g of WRONG.slice(0, 5)) payloads.push(JSON.stringify(await guess(repo, g)));
  for (const p of payloads) {
    // Hints may reveal metadata (e.g. publisher); the answer's identity must never appear.
    for (const banned of ["hollow-knight", "Hollow Knight"]) {
      assert.ok(!p.includes(banned), `payload leaks "${banned}": ${p.slice(0, 200)}`);
    }
  }
});

test("devices are isolated", async () => {
  const repo = makeRepo();
  await guess(repo, WRONG[0]);
  const other = await getTodayState(repo, "22222222-2222-4222-8222-222222222222", NOW);
  assert.equal(other.state!.guesses.length, 0);
});

test("future, missing and unpublished puzzles are not playable", async () => {
  const repo = makeRepo({
    extraPuzzles: [
      {
        id: "draft",
        number: TODAY - 2,
        dateUtc: dateForPuzzleNumber(TODAY - 2),
        answerGameId: "portal",
        hints: ["a", "b"],
        status: "DRAFT",
        voided: false,
      },
    ],
  });
  assert.equal((await guess(repo, WRONG[0], cid(), TODAY + 1)).status, "not_found");
  assert.equal((await guess(repo, WRONG[0], cid(), TODAY - 2)).status, "not_found");
  assert.equal((await guess(repo, WRONG[0], cid(), TODAY - 5)).status, "not_found");
});

test("yesterday: grace only for a game already in progress", async () => {
  const y = TODAY - 1;
  const repo = makeRepo({
    extraPuzzles: [
      {
        id: `p${y}`,
        number: y,
        dateUtc: dateForPuzzleNumber(y),
        answerGameId: "portal",
        hints: ["a", "b"],
        status: "PUBLISHED",
        voided: false,
      },
    ],
  });
  // Not started yesterday -> stale.
  assert.equal((await guess(repo, WRONG[0], cid(), y)).status, "stale_puzzle");
  // Started yesterday -> may finish today.
  const yesterday = new Date(NOW.getTime() - 86_400_000);
  await submitGuess(repo, { deviceId: DEVICE, puzzleNumber: y, gameId: WRONG[0], clientGuessId: cid(), now: yesterday });
  const res = await guess(repo, "portal", cid(), y);
  assert.equal(res.status, "accepted");
  assert.equal(res.state!.outcome, "WON");
});
