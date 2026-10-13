import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Locate a local CLI via its package.json "bin" so it runs with the current Node (no shell; works on Windows). */
function binEntry(pkg: string): string {
  const dir = join(process.cwd(), "node_modules", pkg);
  const meta = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { bin?: string | Record<string, string> };
  const bin = typeof meta.bin === "string" ? meta.bin : meta.bin?.[pkg] ?? Object.values(meta.bin ?? {})[0];
  if (!bin) throw new Error(`No CLI entry found for ${pkg}`);
  return join(dir, bin);
}

export function start(pkg: string, args: string[]): ChildProcess {
  return spawn(process.execPath, [binEntry(pkg), ...args], { stdio: "inherit", env: process.env });
}

export function run(pkg: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = start(pkg, args);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${pkg} ${args.join(" ")} exited with code ${code}`)),
    );
  });
}
