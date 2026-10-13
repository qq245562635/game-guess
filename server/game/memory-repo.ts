import { randomUUID } from "node:crypto";
import type { CandidateEntry, GameAttrs } from "@/lib/types";
import type { GameRepo, NewGuess, PuzzleRecord, SessionRecord } from "./repo";

/** In-memory repo used by tests. Mirrors the unique constraints of the database schema. */
export class MemoryRepo implements GameRepo {
  sessions = new Map<string, SessionRecord>();

  constructor(
    private games: (GameAttrs & { aliases?: string[]; active?: boolean })[],
    private puzzles: PuzzleRecord[],
  ) {}

  async getPuzzleByNumber(n: number) {
    return this.puzzles.find((p) => p.number === n) ?? null;
  }

  async getGameAttrs(id: string) {
    const g = this.games.find((x) => x.id === id && x.active !== false);
    if (!g) return null;
    const { aliases: _a, active: _b, ...attrs } = g;
    return attrs;
  }

  private key(deviceId: string, puzzleId: string) {
    return `${deviceId}:${puzzleId}`;
  }

  async getSession(deviceId: string, puzzleId: string) {
    const s = this.sessions.get(this.key(deviceId, puzzleId));
    return s ? structuredClone(s) : null;
  }

  async getOrCreateSession(deviceId: string, puzzleId: string, _isArchive: boolean, at: Date) {
    const k = this.key(deviceId, puzzleId);
    if (!this.sessions.has(k)) {
      this.sessions.set(k, {
        id: randomUUID(),
        deviceId,
        puzzleId,
        outcome: "IN_PROGRESS",
        startedAt: at,
        completedAt: null,
        guesses: [],
      });
    }
    return structuredClone(this.sessions.get(k)!);
  }

  async appendGuess(sessionId: string, g: NewGuess): Promise<"ok" | "conflict"> {
    const s = [...this.sessions.values()].find((x) => x.id === sessionId);
    if (!s) throw new Error("session not found");
    const clash = s.guesses.some(
      (x) => x.attemptNo === g.attemptNo || x.gameId === g.gameId || x.clientGuessId === g.clientGuessId,
    );
    if (clash) return "conflict";
    s.guesses.push({ attemptNo: g.attemptNo, gameId: g.gameId, clientGuessId: g.clientGuessId, row: g.row });
    s.outcome = g.outcome;
    if (g.outcome !== "IN_PROGRESS") s.completedAt = g.at;
    return "ok";
  }

  async listCandidates(): Promise<CandidateEntry[]> {
    return this.games
      .filter((g) => g.active !== false)
      .map((g) => ({ id: g.id, title: g.title, aliases: g.aliases ?? [], year: g.releaseYear }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }
}
