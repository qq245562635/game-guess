import type { Cell, GameAttrs, Labeled, SetResult, YearResult } from "./types";

export function compareSets(guess: string[], answer: string[]): SetResult {
  const a = new Set(answer);
  const g = new Set(guess);
  let overlap = 0;
  for (const v of g) if (a.has(v)) overlap++;
  if (overlap === 0) return "none";
  if (overlap === a.size && overlap === g.size) return "exact";
  return "partial";
}

export function compareYear(guess: number, answer: number): YearResult {
  if (guess === answer) return "exact";
  return answer < guess ? "answer_earlier" : "answer_later";
}

const slugs = (xs: Labeled[]) => xs.map((x) => x.slug);
const labels = (xs: Labeled[]) => xs.map((x) => x.label);

/** Compare a guessed game against the answer. Order follows DIMENSIONS. */
export function compareGames(guess: GameAttrs, answer: GameAttrs): Cell[] {
  return [
    { dim: "year", value: guess.releaseYear, result: compareYear(guess.releaseYear, answer.releaseYear) },
    { dim: "genres", values: labels(guess.genres), result: compareSets(slugs(guess.genres), slugs(answer.genres)) },
    {
      dim: "platforms",
      values: labels(guess.platforms),
      result: compareSets(slugs(guess.platforms), slugs(answer.platforms)),
    },
    {
      dim: "developer",
      value: guess.developer.label,
      result: guess.developer.slug === answer.developer.slug ? "exact" : "none",
    },
    {
      dim: "publisher",
      value: guess.publisher.label,
      result: guess.publisher.slug === answer.publisher.slug ? "exact" : "none",
    },
    {
      dim: "perspectives",
      values: labels(guess.perspectives),
      result: compareSets(slugs(guess.perspectives), slugs(answer.perspectives)),
    },
  ];
}
