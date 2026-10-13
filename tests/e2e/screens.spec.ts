/**
 * Visual review shots (not assertions). Runs only with SCREENSHOTS=1; images go to ./screenshots.
 */
import { test, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { todayPuzzleNumber } from "../../lib/date-utc";

test.skip(!process.env.SCREENSHOTS, "screenshots only on demand");

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());

async function picks() {
  const p = await db.puzzle.findUniqueOrThrow({
    where: { number: todayPuzzleNumber(new Date()) },
    include: { answerGame: true },
  });
  const others = await db.game.findMany({ where: { id: { not: p.answerGameId } }, orderBy: { slug: "desc" }, take: 3 });
  return { answer: p.answerGame.title, wrong: others.map((g) => g.title) };
}

async function guess(page: Page, title: string) {
  await page.getByRole("combobox").fill(title);
  await page.getByRole("option").filter({ hasText: title }).first().click();
  await page.getByRole("button", { name: "Guess" }).click();
  await page.waitForTimeout(400);
}

async function shoot(browser: Browser, project: Record<string, unknown>, scheme: "light" | "dark", name: string) {
  const ctx = await browser.newContext({ ...project, colorScheme: scheme, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const { answer, wrong } = await picks();
  const out = (step: string) => `screenshots/${name}-${scheme}-${step}.png`;

  await page.goto("/");
  await page.getByText("guesses left").waitFor();
  await page.screenshot({ path: out("1-start"), fullPage: true });

  for (const t of wrong) await guess(page, t);
  await page.getByRole("button", { name: "Reveal hint 1" }).click();
  await page.getByRole("combobox").fill("zel");
  await page.waitForTimeout(200);
  await page.screenshot({ path: out("2-playing"), fullPage: true });

  await page.getByRole("combobox").fill("");
  await guess(page, answer);
  await page.screenshot({ path: out("3-solved-dialog"), fullPage: false });
  await page.keyboard.press("Escape");
  await page.screenshot({ path: out("4-solved"), fullPage: true });
  await ctx.close();
}

for (const scheme of ["light", "dark"] as const) {
  test(`screens ${scheme}`, async ({ browser }, info) => {
    await shoot(browser, info.project.use as Record<string, unknown>, scheme, info.project.name);
  });
}
