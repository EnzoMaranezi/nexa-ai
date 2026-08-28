import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTopicSummarySourceRanges,
  reconstructVerifiedTopicSource,
  STALE_TOPIC_SUMMARY_SOURCE,
  TOPIC_SUMMARY_SOURCE_INVALID,
  TOPIC_SUMMARY_SOURCE_UNAVAILABLE,
} from "./topic-summary-source.ts";
import { hashTopicSource } from "./document-topics.source.ts";

const source = [
  "Escalonamento de processos distribui tempo de CPU entre processos prontos.",
  "Memória virtual separa endereços lógicos da memória física por paginação.",
  "Sistemas de arquivos organizam dados persistentes em diretórios e blocos.",
].join("\n\n");

function rangeFor(fragment: string) {
  const points = Array.from(source);
  const start = source.indexOf(fragment);
  return { start, end: start + Array.from(fragment).length, points };
}

test("topic summary reconstructs only persisted ranges in source order", async () => {
  const scheduling = rangeFor("Escalonamento de processos distribui tempo de CPU entre processos prontos.");
  const files = rangeFor("Sistemas de arquivos organizam dados persistentes em diretórios e blocos.");
  const result = await reconstructVerifiedTopicSource({
    source,
    sourceHash: await hashTopicSource(source),
    sourceRanges: [
      { start: files.start, end: files.end },
      { start: scheduling.start, end: scheduling.end },
    ],
  });

  assert.equal(
    result,
    "Escalonamento de processos distribui tempo de CPU entre processos prontos.\n\nSistemas de arquivos organizam dados persistentes em diretórios e blocos.",
  );
  assert.doesNotMatch(result, /Memória virtual/u);
});

test("topic summary ranges use Unicode code points and preserve accented source", async () => {
  const unicodeSource = "📘 Sincronização coordena processos concorrentes sem perder consistência de dados compartilhados.";
  const points = Array.from(unicodeSource);
  const result = await reconstructVerifiedTopicSource({
    source: unicodeSource,
    sourceHash: await hashTopicSource(unicodeSource),
    sourceRanges: [{ start: 0, end: points.length }],
  });
  assert.equal(result, unicodeSource);
});

test("stale topic hashes are rejected before reconstruction", async () => {
  await assert.rejects(
    reconstructVerifiedTopicSource({
      source,
      sourceHash: "0".repeat(64),
      sourceRanges: [{ start: 0, end: Array.from(source).length }],
    }),
    new RegExp(STALE_TOPIC_SUMMARY_SOURCE),
  );
});

test("invalid or overlapping topic ranges remain strict", async () => {
  assert.throws(
    () => parseTopicSummarySourceRanges([{ start: 0.5, end: 10 }]),
    new RegExp(TOPIC_SUMMARY_SOURCE_INVALID),
  );
  await assert.rejects(
    reconstructVerifiedTopicSource({
      source,
      sourceHash: await hashTopicSource(source),
      sourceRanges: [
        { start: 0, end: 90 },
        { start: 80, end: 170 },
      ],
    }),
    new RegExp(TOPIC_SUMMARY_SOURCE_INVALID),
  );
});

test("empty and too-short grounded sources fail before quota or provider work", async () => {
  await assert.rejects(
    reconstructVerifiedTopicSource({
      source: null,
      sourceHash: "0".repeat(64),
      sourceRanges: [{ start: 0, end: 1 }],
    }),
    new RegExp(TOPIC_SUMMARY_SOURCE_UNAVAILABLE),
  );
  const shortSource = "Conceito curto.";
  await assert.rejects(
    reconstructVerifiedTopicSource({
      source: shortSource,
      sourceHash: await hashTopicSource(shortSource),
      sourceRanges: [{ start: 0, end: Array.from(shortSource).length }],
    }),
    new RegExp(TOPIC_SUMMARY_SOURCE_UNAVAILABLE),
  );
});
