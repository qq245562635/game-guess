import { dateForPuzzleNumber, todayPuzzleNumber } from "@/lib/date-utc";
import { SEED_GAMES, devHints, toAttrs, uniqueAliases } from "@/server/content/seed-data";
import type { PuzzleRecord } from "@/server/game/repo";
import { MemoryRepo } from "@/server/game/memory-repo";

export const NOW = new Date("2026-10-13T12:00:00Z");
export const TODAY = todayPuzzleNumber(NOW);

export const ANSWER_SLUG = "hollow-knight";

export function makeRepo(opts: { answer?: string; extraPuzzles?: PuzzleRecord[] } = {}) {
  const answer = opts.answer ?? ANSWER_SLUG;
  const games = SEED_GAMES.map((g) => ({ ...toAttrs(g), aliases: uniqueAliases(g) }));
  const g = SEED_GAMES.find((x) => x.slug === answer)!;
  const puzzles: PuzzleRecord[] = [
    {
      id: `p${TODAY}`,
      number: TODAY,
      dateUtc: dateForPuzzleNumber(TODAY),
      answerGameId: answer,
      hints: devHints(g),
      status: "PUBLISHED",
      voided: false,
    },
    ...(opts.extraPuzzles ?? []),
  ];
  return new MemoryRepo(games, puzzles);
}

export const DEVICE = "11111111-1111-4111-8111-111111111111";
let n = 0;
export const cid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export const WRONG = ["celeste", "terraria", "doom-1993", "portal", "elden-ring", "cuphead"];
