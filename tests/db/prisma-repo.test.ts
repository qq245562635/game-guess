/**
 * Runs the judge against a real PostgreSQL database (seeded with `npm run db:seed`).
 *   DATABASE_URL=... npm run test:db
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { todayPuzzleNumber } from "@/lib/date-utc";
import { getTodayState, submitGuess } from "@/server/game/judge";
import { PrismaRepo } from "@/server/game/prisma-repo";

const db = new PrismaClient();
const repo = new PrismaRepo(db);
after(() => db.$disconnect());

const now = () => new Date();

async function answerAndWrong() {
  const p = await db.puzzle.findUniqueOrThrow({ where: { number: todayPuzzleNumber(now()) } });
  const wrong = await db.game.findMany({ where: { id: { not: p.answerGameId } }, take: 6, orderBy: { slug: "asc" } });
  return { answerId: p.answerGameId, wrong: wrong.map((g) => g.id) };
}

const play = (deviceId: string, gameId: string, clientGuessId = randomUUID()) =>
  submitGuess(repo, { deviceId, puzzleNumber: todayPuzzleNumber(now()), gameId, clientGuessId, now: now() });

test("today is published and playable", async () => {
  const res = await getTodayState(repo, randomUUID(), now());
  assert.equal(res.available, true);
  assert.equal(res.state!.remaining, 6);
});

test("win flow persists and reveals answer", async () => {
  const { answerId, wrong } = await answerAndWrong();
  const device = randomUUID();
  assert.equal((await play(device, wrong[0])).state!.remaining, 5);
  const win = await play(device, answerId);
  assert.equal(win.state!.outcome, "WON");
  assert.equal(win.state!.answer!.id, answerId);
  const restored = await getTodayState(repo, device, now());
  assert.deepEqual(restored.state, win.state);
});

test("loss flow after 6 wrong guesses", async () => {
  const { answerId, wrong } = await answerAndWrong();
  const device = randomUUID();
  let last;
  for (const g of wrong) last = await play(device, g);
  assert.equal(last!.state!.outcome, "LOST");
  assert.equal(last!.state!.answer!.id, answerId);
  assert.equal((await play(device, answerId)).status, "completed");
});

test("invalid and duplicate guesses do not consume attempts", async () => {
  const { wrong } = await answerAndWrong();
  const device = randomUUID();
  await play(device, wrong[0]);
  assert.equal((await play(device, "not-a-game")).status, "invalid");
  const dup = await play(device, wrong[0]);
  assert.equal(dup.status, "duplicate");
  assert.equal(dup.state!.remaining, 5);
});

test("concurrent and replayed submissions are idempotent", async () => {
  const { wrong } = await answerAndWrong();
  const device = randomUUID();
  const id = randomUUID();
  const results = await Promise.all([
    play(device, wrong[0], id),
    play(device, wrong[0], id),
    play(device, wrong[0], id),
    play(device, wrong[1]),
    play(device, wrong[2]),
  ]);
  assert.ok(results.every((r) => r.status === "accepted"), JSON.stringify(results.map((r) => r.status)));
  const rows = await db.guess.findMany({ where: { session: { deviceId: device } }, orderBy: { attemptNo: "asc" } });
  assert.deepEqual(
    rows.map((r) => r.attemptNo),
    [1, 2, 3],
  );
});
