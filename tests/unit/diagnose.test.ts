import assert from "node:assert/strict";
import { test } from "node:test";
import { diagnose } from "@/server/diagnose";

test("maps common setup failures to hints", () => {
  assert.match(diagnose(new Error("SESSION_SECRET must be set")).hint, /SESSION_SECRET/);
  assert.match(diagnose({ code: "P1001", message: "Can't reach database server at localhost:5432" }).hint, /docker compose/);
  assert.match(diagnose({ code: "P2021", message: 'The table "public.Puzzle" does not exist' }).hint, /db:migrate/);
  assert.match(diagnose(new Error("@prisma/client did not initialize yet")).hint, /db:generate/);
  assert.match(diagnose(new Error("Environment variable not found: DATABASE_URL")).hint, /DATABASE_URL/);
  assert.match(diagnose(new Error("something else")).hint, /terminal/);
});
