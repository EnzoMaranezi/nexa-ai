import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTopicSegmentMap,
  hashTopicSource,
  normalizeTopicSourceRanges,
  reconstructTopicSource,
  segmentDocumentSource,
  topicSegmentToken,
} from "./document-topics.source.ts";

function assertStableExactRanges(source: string) {
  const first = segmentDocumentSource(source);
  const second = segmentDocumentSource(source);
  assert.deepEqual(first, second);
  let previousEnd = -1;
  for (const segment of first) {
    assert.ok(segment.start >= 0);
    assert.ok(segment.end > segment.start);
    assert.ok(segment.start >= previousEnd);
    const exact = reconstructTopicSource(source, [{ start: segment.start, end: segment.end }]);
    assert.equal(exact.replace(/\s+/gu, " ").trim(), segment.text);
    previousEnd = segment.end;
  }
  return first;
}

test("segments heading-rich academic text in stable source order", () => {
  const source = [
    "# Processos",
    "Um processo representa um programa em execução, com estado e recursos próprios. ".repeat(6),
    "# Escalonamento",
    "O escalonador seleciona processos prontos e distribui o tempo da CPU. ".repeat(6),
    "# Sincronização",
    "Semáforos e mutexes coordenam o acesso concorrente a recursos compartilhados. ".repeat(6),
  ].join("\n\n");
  const segments = assertStableExactRanges(source);
  assert.ok(segments.length >= 3);
  assert.match(segments[0]?.text ?? "", /Processos/u);
  assert.match(segments.at(-1)?.text ?? "", /Sincronização/u);
});

test("segments unstructured and pasted notes without headings", () => {
  const unstructured = "Sistemas operacionais gerenciam processos, memória e dispositivos. ".repeat(40);
  const pasted = Array.from(
    { length: 30 },
    (_, index) => `anotação ${index + 1}: concorrência exige coordenação entre tarefas e recursos`,
  ).join("\n");
  assert.ok(assertStableExactRanges(unstructured).length >= 3);
  assert.ok(assertStableExactRanges(pasted).length >= 3);
});

test("serializes deterministic segment tokens without treating content numbers as IDs", () => {
  const numbered = Array.from(
    { length: 12 },
    (_, index) => `${index + 1}. Chapter ${index + 4}: Section ${index + 5} describes an academic mechanism in detail.`,
  ).join("\n");
  const first = segmentDocumentSource(numbered);
  const second = segmentDocumentSource(numbered);
  assert.deepEqual(first.map((segment) => topicSegmentToken(segment.id)), second.map((segment) => topicSegmentToken(segment.id)));

  const map = buildTopicSegmentMap(first);
  const allowedTokens = first.map((segment) => topicSegmentToken(segment.id));
  assert.match(map, new RegExp(`ALLOWED_SEGMENT_TOKENS.*${allowedTokens[0]}`, "su"));
  const serializedTokens = map.match(/SEG:S\d{3}/gu) ?? [];
  assert.equal(serializedTokens.length, first.length * 3);
  assert.ok(serializedTokens.every((token) => allowedTokens.includes(token)));
  assert.match(map, /Chapter 4: Section 5/u);
});

test("uses Unicode code-point offsets and reconstructs emoji and accents exactly", () => {
  const source = "# Memória 🧠\n\nA memória virtual usa páginas e endereços lógicos. ".repeat(20);
  const segments = assertStableExactRanges(source);
  const reconstructed = reconstructTopicSource(source, segments.map(({ start, end }) => ({ start, end })));
  assert.match(reconstructed, /Memória 🧠/u);
  assert.match(reconstructed, /endereços lógicos/u);
});

test("splits oversized sections at safe boundaries", () => {
  const source = `# Seção extensa\n${"Uma frase acadêmica descreve um mecanismo importante. ".repeat(100)}`;
  const segments = assertStableExactRanges(source);
  assert.ok(segments.length > 3);
  assert.ok(segments.every((segment) => segment.end - segment.start <= 1000));
});

test("sorts, deduplicates, merges adjacent ranges, and rejects invalid ranges", () => {
  const source = "abcdefghij";
  assert.deepEqual(
    normalizeTopicSourceRanges(source, [
      { start: 5, end: 10 },
      { start: 0, end: 5 },
      { start: 0, end: 5 },
    ]),
    [{ start: 0, end: 10 }],
  );
  assert.throws(
    () => normalizeTopicSourceRanges(source, [{ start: 0, end: 11 }]),
    /INVALID_TOPIC_SOURCE_RANGE/u,
  );
  assert.throws(
    () => normalizeTopicSourceRanges(source, [{ start: 0, end: 6 }, { start: 5, end: 9 }]),
    /OVERLAPPING_TOPIC_SOURCE_RANGE/u,
  );
});

test("hashes the exact persisted source text", async () => {
  const first = await hashTopicSource("conteúdo\n");
  const second = await hashTopicSource("conteúdo\n");
  const changed = await hashTopicSource("conteúdo");
  assert.match(first, /^[0-9a-f]{64}$/u);
  assert.equal(first, second);
  assert.notEqual(first, changed);
});
