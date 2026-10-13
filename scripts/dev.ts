/**
 * `npm run dev`: start embedded PostgreSQL if needed, then `next dev`.
 * Ctrl+C stops both. Extra args are passed to next (e.g. `npm run dev -- -p 4000`).
 */
import { start } from "./run";
import { ensureLocalDb, loadEnv } from "./local-db";

async function main() {
  loadEnv();
  const db = await ensureLocalDb();
  const next = start("next", ["dev", ...process.argv.slice(2)]);

  let exiting = false;
  const shutdown = async (code: number) => {
    if (exiting) return;
    exiting = true;
    if (next.exitCode === null) next.kill("SIGINT");
    await db.stop().catch(() => {});
    process.exit(code);
  };
  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
  next.on("exit", (code) => shutdown(code ?? 0));
}

main().catch((e) => {
  console.error(`[dev] ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
