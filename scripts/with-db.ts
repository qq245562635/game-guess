/**
 * Run a command with the local database available, e.g.
 *   tsx scripts/with-db.ts prisma migrate deploy --schema db/schema.prisma
 * Starts embedded PostgreSQL first when needed and stops it afterwards.
 */
import { spawn } from "node:child_process";
import { ensureLocalDb, loadEnv } from "./local-db";
import { run } from "./run";

function runNode(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`node exited with code ${code}`))));
  });
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd) throw new Error("usage: with-db.ts <package|node> [args...]");
  loadEnv();
  const db = await ensureLocalDb();
  let failed = false;
  try {
    await (cmd === "node" ? runNode(args) : run(cmd, args));
  } catch (e) {
    failed = true;
    console.error(e instanceof Error ? e.message : e);
  } finally {
    await db.stop();
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
