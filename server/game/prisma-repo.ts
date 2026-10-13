import { Prisma, type PrismaClient } from "@prisma/client";
import type { CandidateEntry, GameAttrs, GuessRow, Labeled } from "@/lib/types";
import type { GameRepo, NewGuess, PuzzleRecord, SessionRecord } from "./repo";

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

class Conflict extends Error {}

const gameInclude = {
  developer: true,
  publisher: true,
  terms: { include: { term: true } },
} satisfies Prisma.GameInclude;

type GameRow = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

function toAttrs(g: GameRow): GameAttrs {
  const terms = (kind: "GENRE" | "PLATFORM" | "PERSPECTIVE"): Labeled[] =>
    g.terms
      .filter((t) => t.term.kind === kind)
      .map((t) => ({ slug: t.term.slug, label: t.term.label }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    id: g.id,
    title: g.title,
    releaseYear: g.releaseYear,
    genres: terms("GENRE"),
    platforms: terms("PLATFORM"),
    perspectives: terms("PERSPECTIVE"),
    developer: { slug: g.developer.slug, label: g.developer.name },
    publisher: { slug: g.publisher.slug, label: g.publisher.name },
  };
}

const sessionInclude = { guesses: { orderBy: { attemptNo: "asc" } } } satisfies Prisma.GuessSessionInclude;
type SessionRow = Prisma.GuessSessionGetPayload<{ include: typeof sessionInclude }>;

function toSession(s: SessionRow): SessionRecord {
  return {
    id: s.id,
    deviceId: s.deviceId,
    puzzleId: s.puzzleId,
    outcome: s.outcome,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    guesses: s.guesses.map((g) => ({
      attemptNo: g.attemptNo,
      gameId: g.gameId,
      clientGuessId: g.clientGuessId,
      row: g.feedback as unknown as GuessRow,
    })),
  };
}

export class PrismaRepo implements GameRepo {
  constructor(private db: PrismaClient) {}

  async getPuzzleByNumber(n: number): Promise<PuzzleRecord | null> {
    const p = await this.db.puzzle.findUnique({ where: { number: n } });
    if (!p || p.number === null || p.dateUtc === null) return null;
    return {
      id: p.id,
      number: p.number,
      dateUtc: p.dateUtc.toISOString().slice(0, 10),
      answerGameId: p.answerGameId,
      hints: [p.hint1, p.hint2],
      status: p.status,
      voided: p.voided,
    };
  }

  async getGameAttrs(id: string): Promise<GameAttrs | null> {
    if (!id) return null;
    const g = await this.db.game.findFirst({ where: { id, status: "ACTIVE" }, include: gameInclude });
    return g ? toAttrs(g) : null;
  }

  async getSession(deviceId: string, puzzleId: string): Promise<SessionRecord | null> {
    const s = await this.db.guessSession.findUnique({
      where: { deviceId_puzzleId: { deviceId, puzzleId } },
      include: sessionInclude,
    });
    return s ? toSession(s) : null;
  }

  async getOrCreateSession(deviceId: string, puzzleId: string, isArchive: boolean, at: Date): Promise<SessionRecord> {
    try {
      const s = await this.db.guessSession.upsert({
        where: { deviceId_puzzleId: { deviceId, puzzleId } },
        create: { deviceId, puzzleId, isArchive, startedAt: at },
        update: {},
        include: sessionInclude,
      });
      return toSession(s);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const s = await this.getSession(deviceId, puzzleId);
      if (!s) throw e;
      return s;
    }
  }

  async appendGuess(sessionId: string, g: NewGuess): Promise<"ok" | "conflict"> {
    try {
      await this.db.$transaction(async (tx) => {
        // Only an in-progress session may take a guess; this also serializes on the session row.
        const updated = await tx.guessSession.updateMany({
          where: { id: sessionId, outcome: "IN_PROGRESS" },
          data: { outcome: g.outcome, completedAt: g.outcome === "IN_PROGRESS" ? null : g.at },
        });
        if (updated.count !== 1) throw new Conflict();
        await tx.guess.create({
          data: {
            sessionId,
            attemptNo: g.attemptNo,
            gameId: g.gameId,
            clientGuessId: g.clientGuessId,
            feedback: g.row as unknown as Prisma.InputJsonValue,
            createdAt: g.at,
          },
        });
      });
      return "ok";
    } catch (e) {
      if (e instanceof Conflict || isUniqueViolation(e)) return "conflict";
      throw e;
    }
  }

  async listCandidates(): Promise<CandidateEntry[]> {
    const games = await this.db.game.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, title: true, releaseYear: true, aliases: { select: { alias: true } } },
      orderBy: { title: "asc" },
    });
    return games.map((g) => ({ id: g.id, title: g.title, year: g.releaseYear, aliases: g.aliases.map((a) => a.alias) }));
  }
}
