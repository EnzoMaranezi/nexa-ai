import assert from "node:assert/strict";
import test from "node:test";
import { hasDocumentSummary } from "./document-summary-readiness.ts";

test("topic summaries do not mark a material's document summary as ready", () => {
  assert.equal(hasDocumentSummary([{ topic_id: "topic-1" }]), false);
});

test("a document-level summary marks a material as ready", () => {
  assert.equal(hasDocumentSummary([{ topic_id: null }]), true);
});

test("a document-level summary remains ready alongside topic summaries", () => {
  assert.equal(
    hasDocumentSummary([{ topic_id: "topic-1" }, { topic_id: null }]),
    true,
  );
});

test("no summaries do not mark a material as ready", () => {
  assert.equal(hasDocumentSummary([]), false);
});
