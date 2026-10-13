import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { todayPuzzleNumber } from "../../lib/date-utc";

const db = new PrismaClient();
let answer: { id: string; title: string };
let wrong: string[];

test.beforeAll(async () => {
  const p = await db.puzzle.findUniqueOrThrow({
    where: { number: todayPuzzleNumber(new Date()) },
    include: { answerGame: true },
  });
  answer = { id: p.answerGame.id, title: p.answerGame.title };
  const others = await db.game.findMany({ where: { id: { not: answer.id } }, orderBy: { slug: "asc" }, take: 6 });
  wrong = others.map((g) => g.title);
});

test.afterAll(() => db.$disconnect());

async function guess(page: Page, title: string) {
  const input = page.getByRole("combobox");
  await input.fill(title);
  await page.getByRole("option").filter({ hasText: title }).first().click();
  await page.getByRole("button", { name: "Guess" }).click();
}

const rows = (page: Page) => page.locator("tbody tr");

test("new game shows 6 attempts and no guesses", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("6 of 6 guesses left")).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
});

test("wrong guess adds one row; refresh restores; then win", async ({ page }) => {
  await page.goto("/");
  await guess(page, wrong[0]);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByText("5 of 6 guesses left")).toBeVisible();

  await page.reload();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByText("5 of 6 guesses left")).toBeVisible();

  await guess(page, answer.title);
  await expect(page.getByRole("dialog")).toContainText("You got it!");
  await expect(page.getByRole("dialog")).toContainText(answer.title);
  await page.keyboard.press("Escape");
  await expect(page.getByText("Solved in 2/6!")).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Solved in 2/6!")).toBeVisible();
});

test("six wrong guesses lose and reveal the answer", async ({ page }) => {
  await page.goto("/");
  for (const t of wrong) await guess(page, t);
  await expect(page.getByRole("dialog")).toContainText("Better luck tomorrow");
  await expect(page.getByRole("dialog")).toContainText(answer.title);
});

test("whole game is playable with the keyboard", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("combobox");
  await input.focus();
  await page.keyboard.type(wrong[1]);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter"); // choose
  await page.keyboard.press("Enter"); // submit
  await expect(rows(page)).toHaveCount(1);
});

test("answer is not in page HTML, today API or JS bundles before the game ends", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  expect(html).not.toContain(answer.title);
  expect(html).not.toContain(answer.id);

  const api = await (await request.get("/api/puzzle/today")).text();
  expect(api).not.toContain(answer.title);
  expect(api).not.toContain(answer.id);

  await page.goto("/");
  const scripts = await page.locator("script[src]").evaluateAll((els) => els.map((e) => (e as HTMLScriptElement).src));
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) {
    const js = await (await request.get(src)).text();
    expect(js, src).not.toContain(answer.title);
  }
});
