/**
 * Zero-install local PostgreSQL using the `embedded-postgres` npm package (real Postgres
 * binaries shipped via npm; no Docker or system install). Used by `npm run setup` and
 * `npm run dev` when DATABASE_URL points at localhost and nothing is listening there yet.
 * Set EMBEDDED_PG=0 to always use your own database instead.
 */
import { existsSync, rmSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";

export const DATA_DIR = join(process.cwd(), ".data", "postgres");

export function loadEnv() {
  try {
    process.loadEnvFile(".env");
  } catch {
    /* no .env yet */
  }
}

export function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, host);
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

export interface LocalDb {
  embedded: boolean;
  stop: () => Promise<void>;
}

/** Start embedded Postgres if DATABASE_URL is local and nothing is listening on its port. */
export async function ensureLocalDb(log = (m: string) => console.log(`[db] ${m}`)): Promise<LocalDb> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set (run `npm run setup` to create .env)");
  const url = new URL(raw);
  const port = Number(url.port || 5432);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (!isLocal || process.env.EMBEDDED_PG === "0") return { embedded: false, stop: async () => {} };
  if (await isPortOpen(port)) {
    log(`using the database already running on port ${port}`);
    return { embedded: false, stop: async () => {} };
  }

  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const user = decodeURIComponent(url.username || "postgres");
  const password = decodeURIComponent(url.password || "postgres");
  const database = url.pathname.replace(/^\//, "") || "postgres";

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user,
    password,
    port,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });

  if (!existsSync(join(DATA_DIR, "PG_VERSION"))) {
    log(`initialising embedded PostgreSQL in .data/postgres (first run only)`);
    await pg.initialise();
  }
  // A crash can leave a stale lock file behind; the port is free, so it is safe to remove.
  rmSync(join(DATA_DIR, "postmaster.pid"), { force: true });
  await pg.start();
  try {
    await pg.createDatabase(database);
  } catch {
    /* already exists */
  }
  log(`embedded PostgreSQL running on port ${port}`);

  let stopped = false;
  return {
    embedded: true,
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await pg.stop();
      log("embedded PostgreSQL stopped");
    },
  };
}
