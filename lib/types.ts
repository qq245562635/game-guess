export const MAX_GUESSES = 6;

export type SetResult = "exact" | "partial" | "none";
export type YearResult = "exact" | "answer_earlier" | "answer_later";
export type Outcome = "IN_PROGRESS" | "WON" | "LOST";

export interface Labeled {
  slug: string;
  label: string;
}

/** Full attributes of a game. Server-only for the answer. */
export interface GameAttrs {
  id: string;
  title: string;
  releaseYear: number;
  genres: Labeled[];
  platforms: Labeled[];
  perspectives: Labeled[];
  developer: Labeled;
  publisher: Labeled;
}

export type Cell =
  | { dim: "year"; value: number; result: YearResult }
  | { dim: "genres" | "platforms" | "perspectives"; values: string[]; result: SetResult }
  | { dim: "developer" | "publisher"; value: string; result: "exact" | "none" };

export type Dimension = Cell["dim"];

export const DIMENSIONS: Dimension[] = [
  "year",
  "genres",
  "platforms",
  "developer",
  "publisher",
  "perspectives",
];

export interface GameSummary {
  id: string;
  title: string;
  year: number;
}

export interface GuessRow {
  game: GameSummary;
  correct: boolean;
  cells: Cell[];
}

/** Entry in the public autocomplete index. Identical every day; carries no attributes. */
export interface CandidateEntry {
  id: string;
  title: string;
  aliases: string[];
  year: number;
}

export interface GameState {
  puzzleNumber: number;
  dateUtc: string;
  maxGuesses: number;
  guesses: GuessRow[];
  remaining: number;
  outcome: Outcome;
  /** Hints unlocked so far (text only appears once unlocked). */
  hints: string[];
  /** Present only once the game is over. */
  answer?: GameSummary;
}
