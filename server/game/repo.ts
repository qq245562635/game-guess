import type { CandidateEntry, GameAttrs, GuessRow, Outcome } from "@/lib/types";

export interface PuzzleRecord {
  id: string;
  number: number;
  dateUtc: string;
  answerGameId: string;
  hints: [string, string];
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "WITHDRAWN" | "RESERVE";
  voided: boolean;
}

export interface GuessRecord {
  attemptNo: number;
  gameId: string;
  clientGuessId: string;
  row: GuessRow;
}

export interface SessionRecord {
  id: string;
  deviceId: string;
  puzzleId: string;
  outcome: Outcome;
  startedAt: Date;
  completedAt: Date | null;
  guesses: GuessRecord[];
}

export interface NewGuess {
  attemptNo: number;
  gameId: string;
  clientGuessId: string;
  row: GuessRow;
  outcome: Outcome;
  at: Date;
}

/** Storage boundary for the judge. Implemented by Prisma in production and in-memory in tests. */
export interface GameRepo {
  getPuzzleByNumber(n: number): Promise<PuzzleRecord | null>;
  /** Active games only. */
  getGameAttrs(id: string): Promise<GameAttrs | null>;
  getSession(deviceId: string, puzzleId: string): Promise<SessionRecord | null>;
  /** Create or return the existing session (must be race-safe). */
  getOrCreateSession(deviceId: string, puzzleId: string, isArchive: boolean, at: Date): Promise<SessionRecord>;
  /**
   * Atomically append a guess and update the session outcome.
   * Returns "conflict" if a unique constraint (attemptNo / gameId / clientGuessId) was hit.
   */
  appendGuess(sessionId: string, guess: NewGuess): Promise<"ok" | "conflict">;
  listCandidates(): Promise<CandidateEntry[]>;
}
