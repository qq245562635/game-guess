import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSearchIndex, normalizeTitle, searchCandidates } from "@/lib/normalize";
import { SEED_GAMES, uniqueAliases } from "@/server/content/seed-data";

const index = buildSearchIndex(
  SEED_GAMES.map((g) => ({ id: g.slug, title: g.title, aliases: uniqueAliases(g), year: g.year })),
);
const ids = (q: string, exclude?: Set<string>) => searchCandidates(index, q, 10, exclude).map((e) => e.id);

test("normalizeTitle folds case, accents, punctuation and &", () => {
  assert.equal(normalizeTitle("Pokémon Red & Blue"), "pokemon red and blue");
  assert.equal(normalizeTitle("  Marvel's   Spider-Man "), "marvels spider man");
  assert.equal(normalizeTitle("CS:GO"), "cs go");
});

test("search by title prefix, alias and word prefixes", () => {
  assert.equal(ids("hollow")[0], "hollow-knight");
  assert.equal(ids("botw")[0], "zelda-botw");
  assert.equal(ids("gta 5")[0], "gta-v");
  assert.equal(ids("pokemon blue")[0], "pokemon-red-blue");
  assert.ok(ids("zelda").includes("zelda-totk"));
  assert.equal(ids("WILD HUNT")[0], "witcher-3");
});

test("empty query returns nothing; excluded ids are skipped", () => {
  assert.deepEqual(ids("   "), []);
  assert.ok(!ids("portal", new Set(["portal"])).includes("portal"));
});
