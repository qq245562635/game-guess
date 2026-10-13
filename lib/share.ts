import { MAX_GUESSES, type Cell, type GuessRow, type Outcome } from "./types";

export const SITE_NAME = "GameGuess";

function cellEmoji(cell: Cell): string {
  if (cell.result === "exact") return "🟩";
  if (cell.result === "partial") return "🟨";
  return "⬛";
}

export interface ShareInput {
  puzzleNumber: number;
  outcome: Exclude<Outcome, "IN_PROGRESS">;
  rows: GuessRow[];
  url: string;
  streak?: number;
  archive?: boolean;
}

/** Spoiler-free result text: no title, hint or reversible encoding of the answer. */
export function buildShareText(input: ShareInput): string {
  const score = input.outcome === "WON" ? `${input.rows.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const header = `${SITE_NAME} #${input.puzzleNumber}${input.archive ? " (Archive)" : ""} ${score}`;
  const grid = input.rows.map((r) => r.cells.map(cellEmoji).join(""));
  const lines = [header, ...grid];
  if (!input.archive && typeof input.streak === "number") lines.push(`Streak: ${input.streak}`);
  lines.push(input.url);
  return lines.join("\n");
}
