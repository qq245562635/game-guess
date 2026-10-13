/**
 * One-command local setup:
 *   1. create .env (random SESSION_SECRET) if missing
 *   2. start embedded PostgreSQL (unless you point DATABASE_URL at your own)
 *   3. prisma generate, migrate, dev seed
 *
 *   npm run setup
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { run } from "./run";
import { ensureLocalDb, loadEnv } from "./local-db";

function ensureEnvFile() {
  const secret = randomBytes(32).toString("base64url");
  if (!existsSync(".env")) {
    const template = readFileSync(".env.example", "utf8");
    writeFileSync(".env", template.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET="${secret}"`));
    console.log("[setup] created .env");
    return;
  }
  const env = readFileSync(".env", "utf8");
  if (/^SESSION_SECRET=("")?\s*$/m.test(env)) {
    writeFileSync(".env", env.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET="${secret}"`));
    console.log("[setup] filled in SESSION_SECRET in .env");
  }
}

async function main() {
  ensureEnvFile();
  loadEnv();
  const db = await ensureLocalDb();
  try {
    await run("prisma", ["generate", "--schema", "db/schema.prisma"]);
    await run("prisma", ["migrate", "deploy", "--schema", "db/schema.prisma"]);
    await run("tsx", ["db/seed.ts"]);
  } finally {
    await db.stop();
  }
  console.log("\n[setup] done. Start the site with: npm run dev");
}

main().catch((e) => {
  console.error(`\n[setup] failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
