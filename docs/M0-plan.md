# M0 – Technical Plan (draft, pending confirmation)

## Stack
Next.js (App Router) + TypeScript + Tailwind, PostgreSQL + Prisma, Vercel + Neon, Upstash Redis (rate limit), Auth.js (owner-only admin).

## Key decisions (defaults, pending confirmation)
- Puzzle switches at 00:00 UTC; sessions started before the switch may finish and still count for the streak (grace rule).
- All guesses judged server-side; idempotent via `clientGuessId`; server is source of truth for in-progress game.
- Share grid: 6 cells per row (one per feedback dimension), no answer info.
- Candidate index (id, title, aliases, year) shipped to client for autocomplete; identical every day, no attributes.
- Puzzle `voided` flag lets clients skip corrected puzzles when computing streaks.
- No images in MVP.

## Milestones
M1 playable slice → M2 return loop → M3 admin → M4 SEO/hint/archive → M5 launch → M6 ads.
