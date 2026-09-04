import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const i18nSource = readFileSync(new URL("./i18n.tsx", import.meta.url), "utf8");
const planSource = readFileSync(new URL("../routes/app.plan.tsx", import.meta.url), "utf8");
const reinforcementSource = readFileSync(new URL("./questions.functions.ts", import.meta.url), "utf8");
const workflowSource = readFileSync(new URL("../components/Workflow.tsx", import.meta.url), "utf8");

test("Study Plan localizes the incorrect-answer reinforcement reason", () => {
  const key = "plan.reinforcementReason.incorrectAnswer";
  assert.equal(i18nSource.match(new RegExp(`"${key}"`, "g"))?.length, 2);
  assert.match(planSource, /t\(`plan\.reinforcementReason\.\$\{area\.reasonCode\}`\)/);
  assert.match(reinforcementSource, /reasonCode: "incorrectAnswer"/);
  assert.doesNotMatch(reinforcementSource, /Prioritized because this question was answered incorrectly/);
});

test("Workflow permits long localized filenames to wrap within mobile cards", () => {
  assert.match(workflowSource, /className="break-all font-mono text-sm text-foreground"/);
});
