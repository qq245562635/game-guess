import assert from "node:assert/strict";
import { test } from "node:test";
import { pathProblem } from "../../scripts/local-db";

test("non-ASCII project path on Windows is reported with a fix", () => {
  const msg = pathProblem("win32", "E:\\BBB_研究\\Claude\\game-guess");
  assert.ok(msg);
  assert.match(msg, /non-ASCII/);
  assert.match(msg, /E:\\code\\game-guess/);
  assert.match(msg, /纯英文路径/);
});

test("ASCII paths and other platforms are fine", () => {
  assert.equal(pathProblem("win32", "E:\\code\\game-guess"), null);
  assert.equal(pathProblem("darwin", "/Users/张三/game-guess"), null);
  assert.equal(pathProblem("linux", "/home/runner/work/game-guess"), null);
});
