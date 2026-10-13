/** Turn common setup failures into an actionable hint (shown only in development). */
export function diagnose(error: unknown): { detail: string; hint: string } {
  const e = error as { message?: string; code?: string; errorCode?: string; name?: string };
  const message = String(e?.message ?? error);
  const code = e?.code ?? e?.errorCode ?? "";

  let hint = "See the terminal running `npm run dev` for the full error.";
  if (/SESSION_SECRET/.test(message)) {
    hint = "Set SESSION_SECRET in .env (32+ random characters), then restart `npm run dev`.";
  } else if (code === "P1001" || /ECONNREFUSED|Can't reach database server/i.test(message)) {
    hint = "Database not reachable. Start it with `docker compose up -d db` and check DATABASE_URL in .env.";
  } else if (code === "P1000" || /Authentication failed/i.test(message)) {
    hint = "Database login failed. Check the user/password in DATABASE_URL.";
  } else if (code === "P1003" || /does not exist/i.test(message) && /database/i.test(message)) {
    hint = "Database does not exist. Check the database name in DATABASE_URL.";
  } else if (code === "P2021" || /table .* does not exist/i.test(message)) {
    hint = "Tables are missing. Run `npm run db:migrate` then `npm run db:seed`.";
  } else if (/did not initialize|prisma generate/i.test(message)) {
    hint = "Prisma client is not generated. Run `npm run db:generate`, then restart `npm run dev`.";
  } else if (/DATABASE_URL/.test(message)) {
    hint = "DATABASE_URL is missing. Copy .env.example to .env and fill it in.";
  }
  return { detail: message.split("\n").filter(Boolean).slice(-3).join(" ").slice(0, 500), hint };
}
