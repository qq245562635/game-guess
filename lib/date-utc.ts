/**
 * Puzzle numbering. Puzzle #1 is on PUZZLE_EPOCH (UTC); the number for any day
 * is fully determined by its UTC date. Change the epoch only before launch.
 */
export const PUZZLE_EPOCH = "2026-10-01";

const DAY_MS = 86_400_000;

function parseDate(dateUtc: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateUtc)) throw new Error(`Invalid UTC date: ${dateUtc}`);
  const ms = Date.parse(`${dateUtc}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new Error(`Invalid UTC date: ${dateUtc}`);
  return ms;
}

export function utcDateString(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function puzzleNumberForDate(dateUtc: string): number {
  return Math.round((parseDate(dateUtc) - parseDate(PUZZLE_EPOCH)) / DAY_MS) + 1;
}

export function dateForPuzzleNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid puzzle number: ${n}`);
  return new Date(parseDate(PUZZLE_EPOCH) + (n - 1) * DAY_MS).toISOString().slice(0, 10);
}

export function todayPuzzleNumber(now: Date): number {
  return puzzleNumberForDate(utcDateString(now));
}

/** Next 00:00 UTC strictly after `now`. */
export function nextSwitchAt(now: Date): Date {
  return new Date(parseDate(utcDateString(now)) + DAY_MS);
}
