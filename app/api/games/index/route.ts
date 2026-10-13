import { getCandidates } from "@/server/game/service";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

/** Full autocomplete index: id, title, aliases, year. Same for every day; no attributes. */
export async function GET() {
  return json(await getCandidates(), { cache: "public, max-age=300, stale-while-revalidate=3600" });
}
