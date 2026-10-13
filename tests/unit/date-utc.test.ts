import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PUZZLE_EPOCH,
  dateForPuzzleNumber,
  nextSwitchAt,
  puzzleNumberForDate,
  todayPuzzleNumber,
} from "@/lib/date-utc";

test("epoch is puzzle #1 and numbers round-trip", () => {
  assert.equal(puzzleNumberForDate(PUZZLE_EPOCH), 1);
  for (const n of [1, 2, 31, 365, 366, 1000]) assert.equal(puzzleNumberForDate(dateForPuzzleNumber(n)), n);
});

test("switch happens exactly at 00:00 UTC regardless of local offset", () => {
  const before = new Date("2026-10-13T23:59:59.999Z");
  const after = new Date("2026-10-14T00:00:00.000Z");
  assert.equal(todayPuzzleNumber(after), todayPuzzleNumber(before) + 1);
  // 5pm in Los Angeles (UTC-7) on Oct 13 is already Oct 14 UTC.
  assert.equal(todayPuzzleNumber(new Date("2026-10-13T17:00:00-07:00")), todayPuzzleNumber(after));
});

test("nextSwitchAt is the next UTC midnight", () => {
  assert.equal(nextSwitchAt(new Date("2026-10-13T12:34:56Z")).toISOString(), "2026-10-14T00:00:00.000Z");
  assert.equal(nextSwitchAt(new Date("2026-10-14T00:00:00Z")).toISOString(), "2026-10-15T00:00:00.000Z");
});

test("leap day and year boundary", () => {
  assert.equal(puzzleNumberForDate("2028-03-01") - puzzleNumberForDate("2028-02-28"), 2);
  assert.equal(puzzleNumberForDate("2027-01-01") - puzzleNumberForDate("2026-12-31"), 1);
});

test("rejects invalid input", () => {
  assert.throws(() => puzzleNumberForDate("2026-13-01"));
  assert.throws(() => puzzleNumberForDate("yesterday"));
  assert.throws(() => dateForPuzzleNumber(0));
});
