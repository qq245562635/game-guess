import type { CandidateEntry } from "./types";

/**
 * Normalize a title or query for matching: case, diacritics, "&", punctuation
 * and whitespace are folded so "Pokémon: Red & Blue" == "pokemon red and blue".
 */
export function normalizeTitle(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

interface IndexedEntry {
  entry: CandidateEntry;
  keys: string[];
}

export function buildSearchIndex(entries: CandidateEntry[]): IndexedEntry[] {
  return entries.map((entry) => ({
    entry,
    keys: [entry.title, ...entry.aliases].map(normalizeTitle).filter(Boolean),
  }));
}

function scoreKey(key: string, q: string, qTokens: string[]): number {
  if (key === q) return 100;
  if (key.startsWith(q)) return 80;
  const words = key.split(" ");
  if (qTokens.every((t) => words.some((w) => w.startsWith(t)))) return 60;
  if (key.includes(q)) return 40;
  return 0;
}

/** Rank candidates for a query. Ties break alphabetically so ordering never depends on the answer. */
export function searchCandidates(
  index: IndexedEntry[],
  query: string,
  limit = 10,
  exclude: ReadonlySet<string> = new Set(),
): CandidateEntry[] {
  const q = normalizeTitle(query);
  if (!q) return [];
  const qTokens = q.split(" ");
  const scored: { entry: CandidateEntry; score: number }[] = [];
  for (const item of index) {
    if (exclude.has(item.entry.id)) continue;
    let best = 0;
    for (const key of item.keys) best = Math.max(best, scoreKey(key, q, qTokens));
    if (best > 0) scored.push({ entry: item.entry, score: best });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return scored.slice(0, limit).map((s) => s.entry);
}
