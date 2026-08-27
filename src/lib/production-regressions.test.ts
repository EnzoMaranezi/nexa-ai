import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runBoundedServerOperation, SERVER_OPERATION_TIMEOUT } from "./bounded-server-operation.ts";
import { resolveSummaryAvailability, type SummaryAvailabilityVariant } from "./summary-availability.ts";
import type { StudySummary } from "./summary.schema.ts";
import { buildProgressOverview, type ProgressSessionRow } from "./progress-overview.ts";

const summaryUi = readFileSync(
  new URL("../components/app/DocumentSummary.tsx", import.meta.url),
  "utf8",
);
const progressUi = readFileSync(new URL("../routes/app.results.tsx", import.meta.url), "utf8");
const progressServer = readFileSync(new URL("./progress.functions.ts", import.meta.url), "utf8");

const content: StudySummary = {
  title: "Saved",
  keyConcepts: [],
  explanations: [],
  definitions: [],
  relationships: [],
  review: "Review",
};

function variant(locale: "en" | "pt-BR" | "und"): SummaryAvailabilityVariant {
  return {
    id: locale,
    locale,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    summary: content,
  };
}

test("summary availability resolves active, alternate, legacy, and missing states", () => {
  const active = resolveSummaryAvailability([variant("pt-BR"), variant("en")], "pt-BR");
  assert.equal(active.current?.locale, "pt-BR");
  assert.deepEqual(active.alternatives.map((item) => item.locale), ["en"]);

  const alternate = resolveSummaryAvailability([variant("en")], "pt-BR");
  assert.equal(alternate.current, null);
  assert.deepEqual(alternate.alternatives.map((item) => item.locale), ["en"]);

  const legacy = resolveSummaryAvailability([variant("und")], "pt-BR");
  assert.equal(legacy.current, null);
  assert.deepEqual(legacy.alternatives.map((item) => item.locale), ["und"]);

  assert.deepEqual(resolveSummaryAvailability([], "pt-BR").alternatives, []);
});

test("bounded server operation retries one timeout and then resolves", async () => {
  let calls = 0;
  const result = await runBoundedServerOperation(
    async () => {
      calls += 1;
      if (calls === 1) await new Promise((resolve) => setTimeout(resolve, 20));
      return "loaded";
    },
    { timeoutMs: 5, attempts: 2 },
  );
  assert.equal(result, "loaded");
  assert.equal(calls, 2);
});

test("bounded server operation terminates repeated loading and does not retry server failures", async () => {
  await assert.rejects(
    runBoundedServerOperation(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return "late";
      },
      { timeoutMs: 5, attempts: 2 },
    ),
    new RegExp(SERVER_OPERATION_TIMEOUT),
  );

  let calls = 0;
  await assert.rejects(
    runBoundedServerOperation(
      async () => {
        calls += 1;
        throw new Error("RLS failure");
      },
      { timeoutMs: 5, attempts: 2 },
    ),
    /RLS failure/,
  );
  assert.equal(calls, 1);
});

test("summary and Progress render controlled terminal states for server failures", () => {
  assert.match(summaryUi, /\.finally\(\(\) => \{[\s\S]*setChecking\(false\)/);
  assert.match(summaryUi, /summary\.loadError/);
  assert.match(summaryUi, /setLookupAttempt/);
  assert.match(progressUi, /if \(error\)[\s\S]*<ErrorState/);
  assert.match(progressUi, /if \(!data \|\| data\.totalSessions === 0\)[\s\S]*<EmptyState/);
});

test("Progress keeps persisted multilingual and legacy sessions document-scoped", () => {
  const row = (id: string, documentId: string, total: number, correct: number): ProgressSessionRow => ({
    id,
    document_id: documentId,
    total_questions: total,
    correct_answers: correct,
    accuracy: (correct / total) * 100,
    completed_at: "2026-08-27T00:00:00.000Z",
    documents: { title: `Document ${documentId}` },
  });
  const overview = buildProgressOverview({
    // Session rows are intentionally locale-agnostic: EN, PT-BR, and legacy sets all persist here.
    completedRows: [row("en", "doc-a", 5, 4), row("pt-BR", "doc-a", 5, 3), row("und", "doc-b", 4, 2)],
    activeRow: null,
    materialsTotal: 3,
  });
  assert.equal(overview.totalSessions, 3);
  assert.equal(overview.totalQuestions, 14);
  assert.equal(overview.totalCorrect, 9);
  assert.equal(overview.perMaterial.find((item) => item.documentId === "doc-a")?.sessions, 2);

  const empty = buildProgressOverview({ completedRows: [], activeRow: null, materialsTotal: 0 });
  assert.equal(empty.totalSessions, 0);
  assert.deepEqual(empty.perMaterial, []);

  assert.match(progressServer, /from\("question_sessions"\)/);
  assert.doesNotMatch(progressServer, /question_sets\([^)]*locale|\.eq\("locale"|\.eq\("kind"/);
  assert.match(progressServer, /materialsTotal: docsRes\.count \?\? 0/);
  assert.match(progressServer, /if \(docsRes\.error\) throw new Error/);
});
