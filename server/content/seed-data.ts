import companies from "@/content/companies.json";
import rawGames from "@/content/seed/games.json";
import vocab from "@/content/vocab.json";
import { normalizeTitle } from "@/lib/normalize";
import type { GameAttrs, Labeled } from "@/lib/types";

export interface SeedGame {
  slug: string;
  title: string;
  aliases: string[];
  year: number;
  genres: string[];
  platforms: string[];
  developer: string;
  publisher: string;
  perspectives: string[];
}

type VocabKind = keyof typeof vocab;

export const VOCAB = vocab as Record<VocabKind, Record<string, string>>;
export const COMPANIES = companies as Record<string, string>;

function label(kind: VocabKind, slug: string): Labeled {
  return { slug, label: VOCAB[kind][slug] };
}

/** Validate seed data against controlled vocabularies. Returns a list of problems (empty = valid). */
export function validateSeed(games: SeedGame[]): string[] {
  const problems: string[] = [];
  const seenKeys = new Map<string, string>();
  const seenSlugs = new Set<string>();
  for (const g of games) {
    if (seenSlugs.has(g.slug)) problems.push(`duplicate slug ${g.slug}`);
    seenSlugs.add(g.slug);
    if (!Number.isInteger(g.year) || g.year < 1970 || g.year > 2100) problems.push(`${g.slug}: bad year`);
    for (const kind of ["genres", "platforms", "perspectives"] as const) {
      if (g[kind].length === 0) problems.push(`${g.slug}: no ${kind}`);
      for (const v of g[kind]) if (!(v in VOCAB[kind])) problems.push(`${g.slug}: unknown ${kind} "${v}"`);
    }
    for (const c of [g.developer, g.publisher]) if (!(c in COMPANIES)) problems.push(`${g.slug}: unknown company "${c}"`);
    for (const key of new Set([g.title, ...g.aliases].map(normalizeTitle))) {
      const owner = seenKeys.get(key);
      if (owner && owner !== g.slug) problems.push(`title/alias "${key}" used by ${owner} and ${g.slug}`);
      seenKeys.set(key, g.slug);
    }
  }
  return problems;
}

/** Aliases with duplicates (and copies of the title) removed after normalization. */
export function uniqueAliases(g: SeedGame): string[] {
  const seen = new Set([normalizeTitle(g.title)]);
  const out: string[] = [];
  for (const a of g.aliases) {
    const n = normalizeTitle(a);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(a);
    }
  }
  return out;
}

export function toAttrs(g: SeedGame, id = g.slug): GameAttrs {
  return {
    id,
    title: g.title,
    releaseYear: g.year,
    genres: g.genres.map((s) => label("genres", s)),
    platforms: g.platforms.map((s) => label("platforms", s)),
    perspectives: g.perspectives.map((s) => label("perspectives", s)),
    developer: { slug: g.developer, label: COMPANIES[g.developer] },
    publisher: { slug: g.publisher, label: COMPANIES[g.publisher] },
  };
}

export const SEED_GAMES = rawGames as SeedGame[];

/** Deterministic shuffle (mulberry32) so dev schedules are stable but not alphabetical. */
export function shuffled<T>(items: T[], seed = 20261013): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** DEV ONLY: placeholder hints generated from metadata. Real hints are written and reviewed in the admin (M3). */
export function devHints(g: SeedGame): [string, string] {
  const decade = Math.floor(g.year / 10) * 10;
  return [`Released in the ${decade}s.`, `Published by ${COMPANIES[g.publisher]}.`];
}
