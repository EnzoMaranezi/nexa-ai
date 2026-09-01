import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classifyPerformance,
  performanceBandTranslationKeys,
} from "./questions.schema.ts";

const i18nSource = readFileSync(new URL("./i18n.tsx", import.meta.url), "utf8");
const resultSource = readFileSync(
  new URL("../components/app/QuestionSessionResult.tsx", import.meta.url),
  "utf8",
);

const cases = [
  { accuracy: 90, key: "results.performance.excellent" },
  { accuracy: 70, key: "results.performance.good" },
  { accuracy: 50, key: "results.performance.review" },
  { accuracy: 49, key: "results.performance.reviewBeforeNext" },
] as const;

test("all question-result performance bands have EN and PT-BR translations", () => {
  for (const { accuracy, key } of cases) {
    const band = classifyPerformance(accuracy);
    assert.equal(performanceBandTranslationKeys[band], key);
    assert.equal(i18nSource.match(new RegExp(`"${key}"`, "g"))?.length, 2);
  }
  assert.match(resultSource, /t\(performanceBandTranslationKeys\[band\]\)/);
});

test("the lowest result recommendation is localized without changing its threshold", () => {
  const key = performanceBandTranslationKeys[classifyPerformance(20)];
  assert.equal(key, "results.performance.reviewBeforeNext");
  assert.match(i18nSource, /"We recommend reviewing the material before another session"/);
  assert.match(i18nSource, /"Recomendamos revisar o material antes de outra sessao"/);
});
