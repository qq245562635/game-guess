import assert from "node:assert/strict";
import { test } from "node:test";
import { softHyphenate } from "@/lib/hyphenate";

const show = (s: string) => softHyphenate(s).replace(/­/g, "-");

test("long words get syllable break points", () => {
  assert.equal(show("Blizzard Entertainment"), "Blizzard Entertain-ment");
  assert.equal(show("Sony Interactive Entertainment"), "Sony Inter-active Entertain-ment");
  assert.equal(show("Kojima Productions"), "Kojima Produc-tions");
  assert.equal(show("Metroidvania"), "Metroid-vania");
});

test("short words and plain text are untouched", () => {
  assert.equal(softHyphenate("Nintendo EPD"), "Nintendo EPD");
  assert.equal(softHyphenate("Third-person"), "Third-person");
});
