# GameGuess

A daily video game guessing game. Everyone gets the same game each UTC day and has six
tries; every guess reveals how its release year, genres, launch platforms, developer,
publisher and camera perspective compare with the answer.

Status: **M1 – playable slice** (today's puzzle, search, server-judged guesses, feedback,
win/lose, restore on refresh). See `docs/` for the plan and later milestones.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Prisma · Playwright

## Run locally

Requirements: Node 22+, Docker (or any PostgreSQL 16).

```bash
cp .env.example .env            # then set SESSION_SECRET (command is in the file)
docker compose up -d db         # PostgreSQL on localhost:5432
npm install
npm run db:generate
npm run db:migrate              # apply migrations
npm run db:seed                 # DEV data: ~68 games, puzzles from yesterday to +30 days
npm run dev                     # http://localhost:3000
```

> The seed is **unreviewed development data** with placeholder hints. Production content
> is entered and reviewed through the admin (M3).

## Tests

| Command | What it covers | Needs DB |
|---|---|---|
| `npm test` | Unit + integration: comparison rules, UTC switch, search normalization, share text, device token, seed validation, judge (win/loss, invalid/duplicate, idempotent + concurrent submits, hint unlocks, no answer leak, grace window) | No |
| `npm run test:db` | Judge against PostgreSQL via Prisma (persist/restore, concurrency) | Yes, seeded |
| `npm run test:e2e` | Browser: new game, guess, refresh restore, win, loss, keyboard-only, no answer in HTML / API / JS bundles (desktop + mobile) | Yes, seeded + `npm run build` |
| `npm run typecheck` | TypeScript | No |
| `npm run db:check` | Migrations match `db/schema.prisma` | Shadow DB |

CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull request.

## Project layout

```
app/            pages and API routes (/api/puzzle/today, /api/games/index, /api/games/search, /api/guess)
components/     game UI (search, guess table, dialogs, countdown)
lib/            pure logic shared by client and server (compare, dates, normalize, share)
server/         judge service, repositories, device session, rate limiting
db/             Prisma schema, migrations, dev seed
content/        controlled vocabularies, companies, dev seed games
tests/          unit, integration, db, e2e
```

## Rules that the code guarantees

- The answer never reaches the client before the game ends: guesses are judged on the
  server, the autocomplete index has no attributes, and today's API returns no answer id.
- Guess submission is idempotent (`clientGuessId`); invalid, unknown and repeated guesses
  never consume an attempt.
- The puzzle switches at 00:00 UTC. A game started before the switch may still be
  finished afterwards (grace rule).
