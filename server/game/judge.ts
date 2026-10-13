import { compareGames } from "@/lib/compare";
import { dateForPuzzleNumber, todayPuzzleNumber } from "@/lib/date-utc";
import { MAX_GUESSES, type GameAttrs, type GameState, type GameSummary, type Outcome } from "@/lib/types";
import type { GameRepo, PuzzleRecord, SessionRecord } from "./repo";

export type GuessStatus =
  | "accepted" // new guess recorded (or an idempotent replay of one)
  | "duplicate" // game already guessed; no attempt consumed
  | "invalid" // unknown or inactive game; no attempt consumed
  | "completed" // game already over
  | "stale_puzzle" // not today's puzzle and not within the grace window
  | "not_found"; // puzzle missing, unpublished, or in the future

export interface GuessResponse {
  status: GuessStatus;
  state?: GameState;
}

export interface TodayResponse {
  puzzleNumber: number;
  dateUtc: string;
  available: boolean;
  state?: GameState;
}

const HINT_UNLOCKS = [2, 4] as const; // wrong guesses needed for hint 1 and 2

const summary = (g: GameAttrs): GameSummary => ({ id: g.id, title: g.title, year: g.releaseYear });

export function isPlayable(p: PuzzleRecord | null): p is PuzzleRecord {
  return !!p && p.status === "PUBLISHED" && !p.voided;
}

function emptyState(puzzle: PuzzleRecord): GameState {
  return {
    puzzleNumber: puzzle.number,
    dateUtc: puzzle.dateUtc,
    maxGuesses: MAX_GUESSES,
    guesses: [],
    remaining: MAX_GUESSES,
    outcome: "IN_PROGRESS",
    hints: [],
  };
}

async function buildState(repo: GameRepo, puzzle: PuzzleRecord, session: SessionRecord | null): Promise<GameState> {
  if (!session) return emptyState(puzzle);
  const rows = [...session.guesses].sort((a, b) => a.attemptNo - b.attemptNo).map((g) => g.row);
  const wrong = rows.filter((r) => !r.correct).length;
  const over = session.outcome !== "IN_PROGRESS";
  const hints = puzzle.hints.filter((_, i) => over || wrong >= HINT_UNLOCKS[i]);
  const state: GameState = {
    ...emptyState(puzzle),
    guesses: rows,
    remaining: MAX_GUESSES - rows.length,
    outcome: session.outcome,
    hints,
  };
  if (over) {
    const answer = await repo.getGameAttrs(puzzle.answerGameId);
    if (answer) state.answer = summary(answer);
  }
  return state;
}

export async function getTodayState(repo: GameRepo, deviceId: string | null, now: Date): Promise<TodayResponse> {
  const n = todayPuzzleNumber(now);
  const puzzle = await repo.getPuzzleByNumber(n);
  if (!isPlayable(puzzle)) return { puzzleNumber: n, dateUtc: dateForPuzzleNumber(n), available: false };
  const session = deviceId ? await repo.getSession(deviceId, puzzle.id) : null;
  return { puzzleNumber: n, dateUtc: puzzle.dateUtc, available: true, state: await buildState(repo, puzzle, session) };
}

export interface GuessInput {
  deviceId: string;
  puzzleNumber: number;
  gameId: string;
  clientGuessId: string;
  now: Date;
}

export async function submitGuess(repo: GameRepo, input: GuessInput): Promise<GuessResponse> {
  const today = todayPuzzleNumber(input.now);
  if (!Number.isInteger(input.puzzleNumber) || input.puzzleNumber < 1 || input.puzzleNumber > today) {
    return { status: "not_found" };
  }
  const puzzle = await repo.getPuzzleByNumber(input.puzzleNumber);
  if (!isPlayable(puzzle)) return { status: "not_found" };

  let session = await repo.getSession(input.deviceId, puzzle.id);

  // Grace rule: a game started before the switch may be finished the next UTC day.
  if (input.puzzleNumber < today) {
    const inGrace = input.puzzleNumber === today - 1 && session?.outcome === "IN_PROGRESS";
    if (!inGrace) return { status: "stale_puzzle" };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    session ??= await repo.getOrCreateSession(input.deviceId, puzzle.id, false, input.now);

    // Idempotent replay of a submission we already recorded.
    if (session.guesses.some((g) => g.clientGuessId === input.clientGuessId)) {
      return { status: "accepted", state: await buildState(repo, puzzle, session) };
    }
    if (session.outcome !== "IN_PROGRESS") {
      return { status: "completed", state: await buildState(repo, puzzle, session) };
    }
    const game = await repo.getGameAttrs(input.gameId);
    if (!game) return { status: "invalid", state: await buildState(repo, puzzle, session) };
    if (session.guesses.some((g) => g.gameId === game.id)) {
      return { status: "duplicate", state: await buildState(repo, puzzle, session) };
    }

    const answer = await repo.getGameAttrs(puzzle.answerGameId);
    if (!answer) throw new Error(`Answer game missing for puzzle #${puzzle.number}`);

    const correct = game.id === answer.id;
    const attemptNo = session.guesses.length + 1;
    const outcome: Outcome = correct ? "WON" : attemptNo >= MAX_GUESSES ? "LOST" : "IN_PROGRESS";
    const row = { game: summary(game), correct, cells: compareGames(game, answer) };

    const res = await repo.appendGuess(session.id, {
      attemptNo,
      gameId: game.id,
      clientGuessId: input.clientGuessId,
      row,
      outcome,
      at: input.now,
    });
    // Reload so the state reflects exactly what is stored, including concurrent writes.
    session = await repo.getSession(input.deviceId, puzzle.id);
    if (res === "ok" && session) {
      return { status: "accepted", state: await buildState(repo, puzzle, session) };
    }
    // Conflict: another request won the race; loop re-evaluates against fresh state.
  }
  throw new Error("Guess could not be recorded after retries");
}
