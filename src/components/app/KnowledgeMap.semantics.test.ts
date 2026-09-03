import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./KnowledgeMap.tsx", import.meta.url), "utf8");

test("Knowledge Map renders extracted concepts without inferred learning or dependency signals", () => {
  assert.match(source, /label: concept\.title/);
  assert.doesNotMatch(source, /concept\.mastery/);
  assert.doesNotMatch(source, /concept\.difficulty/);
  assert.doesNotMatch(source, /concept\.parent/);
  assert.doesNotMatch(source, /<line/);
});
