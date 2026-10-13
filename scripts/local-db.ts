/**
 * Zero-install local PostgreSQL using the `embedded-postgres` npm package (real Postgres
 * binaries shipped via npm; no Docker or system install). Used by `npm run setup` and
 * `npm run dev` when DATABASE_URL points at localhost and nothing is listening there yet.
 * Set EMBEDDED_PG=0 to always use your own database instead.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { connect } from "node:net";
import { join } from "node:path";

export const DATA_DIR = join(process.cwd(), ".data", "postgres");

/** Find pg_ctl inside the platform package that embedded-postgres installed. */
function findPgCtl(): string | null {
  const root = join(process.cwd(), "node_modules", "@embedded-postgres");
  const exe = process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl";
  const stack = existsSync(root) ? [root] : [];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (name === exe) return full;
      if (statSync(full).isDirectory()) stack.push(full);
    }
  }
  return null;
}

/**
 * Postgres on Windows cannot initialise when its install path (node_modules inside this
 * project) contains non-ASCII characters and the system code page is not UTF-8.
 */
export function pathProblem(platform: string, cwd: string): string | null {
  if (platform !== "win32" || !/[^\x00-\x7f]/.test(cwd)) return null;
  return [
    `The project path contains non-ASCII characters: ${cwd}`,
    "Embedded PostgreSQL on Windows cannot start from such a path.",
    "Fix: move the project to an ASCII-only folder (e.g. E:\\code\\game-guess), delete .data, and run `npm run setup` again.",
    "项目路径包含中文等非 ASCII 字符，Windows 上内嵌数据库无法初始化。",
    "请把项目移到纯英文路径（例如 E:\\code\\game-guess），删除 .data 文件夹后重新运行 npm run setup。",
    "Alternatively set EMBEDDED_PG=0 and point DATABASE_URL at your own PostgreSQL.",
  ].join("\n");
}

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

  const problem = pathProblem(process.platform, process.cwd());
  if (problem) throw new Error(problem);

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
    // Independent of the OS locale (e.g. "Chinese (Simplified)_China.936" on Windows).
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: (m: unknown) => remember(m),
    onError: (m: unknown) => remember(m),
  });

  // Keep Postgres' own output quiet unless something fails.
  const recent: string[] = [];
  function remember(m: unknown) {
    for (const line of String(m instanceof Error ? m.message : m).split(/\r?\n/)) {
      if (line.trim()) recent.push(line.trim());
    }
    if (recent.length > 40) recent.splice(0, recent.length - 40);
  }
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      const reason = e instanceof Error ? e.message : e === undefined ? "" : String(e);
      throw new Error(`embedded PostgreSQL ${name} failed${reason ? `: ${reason}` : ""}\n${recent.slice(-15).join("\n")}`);
    }
  };

  if (!existsSync(join(DATA_DIR, "PG_VERSION"))) {
    log(`initialising embedded PostgreSQL in .data/postgres (first run only)`);
    await step("initialise", () => pg.initialise());
  }
  // A crash can leave a stale lock file behind; the port is free, so it is safe to remove.
  rmSync(join(DATA_DIR, "postmaster.pid"), { force: true });
  // On Windows, postgres.exe refuses to run from an elevated (admin) shell; pg_ctl drops
  // privileges for it, so start and stop through pg_ctl there.
  const pgCtl = process.platform === "win32" ? findPgCtl() : null;
  const logFile = join(DATA_DIR, "..", "postgres.log");
  if (pgCtl) {
    // stdio must be "ignore": postgres.exe inherits pg_ctl's handles and would keep pipes open forever.
    const r = spawnSync(pgCtl, ["-D", DATA_DIR, "-o", `-p ${port}`, "-l", logFile, "-w", "-t", "60", "start"], {
      stdio: "ignore",
      timeout: 90_000,
    });
    if (r.status !== 0) {
      const tail = existsSync(logFile) ? readFileSync(logFile, "utf8").split(/\r?\n/).slice(-15).join("\n") : "";
      throw new Error(`embedded PostgreSQL start failed (pg_ctl exit ${r.status ?? r.error?.message})\n${tail}`);
    }
  } else {
    await step("start", () => pg.start());
  }
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
      if (pgCtl) spawnSync(pgCtl, ["-D", DATA_DIR, "-m", "fast", "-w", "stop"], { stdio: "ignore", timeout: 60_000 });
      else await pg.stop();
      log("embedded PostgreSQL stopped");
    },
  };
}
