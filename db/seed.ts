/**
 * DEV SEED. Loads the controlled vocabulary, companies and the unreviewed dev game list,
 * then schedules PUBLISHED puzzles from yesterday through the next 30 days.
 * Real content goes through the admin (M3) with second-person review.
 *
 *   npm run db:seed
 */
import { PrismaClient, type TermKind } from "@prisma/client";
import { dateForPuzzleNumber, todayPuzzleNumber } from "../lib/date-utc";
import { normalizeTitle } from "../lib/normalize";
import { COMPANIES, SEED_GAMES, VOCAB, devHints, shuffled, uniqueAliases, validateSeed } from "../server/content/seed-data";

const db = new PrismaClient();

const KIND: Record<keyof typeof VOCAB, TermKind> = {
  genres: "GENRE",
  platforms: "PLATFORM",
  perspectives: "PERSPECTIVE",
};

async function main() {
  const problems = validateSeed(SEED_GAMES);
  if (problems.length) throw new Error(`Seed data invalid:\n${problems.join("\n")}`);

  const companyIds = new Map<string, string>();
  for (const [slug, name] of Object.entries(COMPANIES)) {
    const c = await db.company.upsert({ where: { slug }, create: { slug, name }, update: { name } });
    companyIds.set(slug, c.id);
  }

  const termIds = new Map<string, string>();
  for (const [group, entries] of Object.entries(VOCAB) as [keyof typeof VOCAB, Record<string, string>][]) {
    for (const [slug, label] of Object.entries(entries)) {
      const kind = KIND[group];
      const t = await db.term.upsert({
        where: { kind_slug: { kind, slug } },
        create: { kind, slug, label },
        update: { label },
      });
      termIds.set(`${group}:${slug}`, t.id);
    }
  }

  const gameIds = new Map<string, string>();
  for (const g of SEED_GAMES) {
    const data = {
      title: g.title,
      normTitle: normalizeTitle(g.title),
      releaseYear: g.year,
      developerId: companyIds.get(g.developer)!,
      publisherId: companyIds.get(g.publisher)!,
      answerEligible: true,
      status: "ACTIVE" as const,
    };
    const game = await db.game.upsert({ where: { slug: g.slug }, create: { slug: g.slug, ...data }, update: data });
    gameIds.set(g.slug, game.id);

    await db.alias.deleteMany({ where: { gameId: game.id } });
    await db.gameTerm.deleteMany({ where: { gameId: game.id } });
    for (const alias of uniqueAliases(g)) {
      await db.alias.create({ data: { gameId: game.id, alias, norm: normalizeTitle(alias) } });
    }
    const termKeys = [
      ...g.genres.map((s) => `genres:${s}`),
      ...g.platforms.map((s) => `platforms:${s}`),
      ...g.perspectives.map((s) => `perspectives:${s}`),
    ];
    await db.gameTerm.createMany({ data: termKeys.map((k) => ({ gameId: game.id, termId: termIds.get(k)! })) });
  }

  const today = todayPuzzleNumber(new Date());
  const order = shuffled(SEED_GAMES);
  let scheduled = 0;
  for (let n = Math.max(1, today - 1); n <= today + 30; n++) {
    const g = order[n % order.length];
    const [hint1, hint2] = devHints(g);
    const dateUtc = new Date(`${dateForPuzzleNumber(n)}T00:00:00Z`);
    const data = { answerGameId: gameIds.get(g.slug)!, hint1, hint2, status: "PUBLISHED" as const };
    await db.puzzle.upsert({ where: { number: n }, create: { number: n, dateUtc, ...data }, update: data });
    scheduled++;
  }

  console.log(`Seeded ${SEED_GAMES.length} games, ${termIds.size} terms, ${companyIds.size} companies, ${scheduled} puzzles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
