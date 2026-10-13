import assert from "node:assert/strict";
import { test } from "node:test";
import { compareGames, compareSets, compareYear } from "@/lib/compare";
import { SEED_GAMES, toAttrs } from "@/server/content/seed-data";

const attrs = (slug: string) => toAttrs(SEED_GAMES.find((g) => g.slug === slug)!);

test("compareSets: exact, partial, none", () => {
  assert.equal(compareSets(["a", "b"], ["b", "a"]), "exact");
  assert.equal(compareSets(["a"], ["a", "b"]), "partial");
  assert.equal(compareSets(["a", "b"], ["a"]), "partial");
  assert.equal(compareSets(["a", "c"], ["a", "b"]), "partial");
  assert.equal(compareSets(["c"], ["a", "b"]), "none");
  assert.equal(compareSets(["a", "a"], ["a"]), "exact");
});

test("compareYear: direction is relative to the answer", () => {
  assert.equal(compareYear(2017, 2017), "exact");
  assert.equal(compareYear(2020, 2015), "answer_earlier");
  assert.equal(compareYear(2010, 2015), "answer_later");
});

test("compareGames: same game is all exact", () => {
  const cells = compareGames(attrs("elden-ring"), attrs("elden-ring"));
  assert.deepEqual(
    cells.map((c) => c.dim),
    ["year", "genres", "platforms", "developer", "publisher", "perspectives"],
  );
  assert.ok(cells.every((c) => c.result === "exact"));
});

test("compareGames: Dark Souls vs Elden Ring", () => {
  const cells = Object.fromEntries(compareGames(attrs("dark-souls"), attrs("elden-ring")).map((c) => [c.dim, c]));
  assert.equal(cells.year.result, "answer_later");
  assert.equal(cells.genres.result, "exact");
  assert.equal(cells.platforms.result, "none");
  assert.equal(cells.developer.result, "exact");
  assert.equal(cells.publisher.result, "exact");
  assert.equal(cells.perspectives.result, "exact");
});

test("compareGames: cells show the guessed game's values, never the answer's", () => {
  const cells = compareGames(attrs("portal"), attrs("hollow-knight"));
  const json = JSON.stringify(cells);
  assert.ok(json.includes("Valve"));
  assert.ok(!json.includes("Team Cherry"));
  assert.ok(!json.includes("Metroidvania"));
});
