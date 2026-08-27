import assert from "node:assert/strict";
import test from "node:test";
import { parseTopicDiscoveryResponse } from "./document-topics.parser.ts";
import { segmentDocumentSource, topicSegmentToken } from "./document-topics.source.ts";

const source = [
  "# Processos\n" + "Processos mantêm estado, contexto e recursos durante a execução. ".repeat(16),
  "# Escalonamento\n" + "Escalonamento escolhe tarefas prontas e distribui tempo de CPU. ".repeat(16),
  "# Sincronização\n" + "Mutexes e semáforos protegem recursos compartilhados entre tarefas. ".repeat(16),
].join("\n\n");
const segments = segmentDocumentSource(source);

function validOutput() {
  const groups = [[], [], []] as string[][];
  segments.forEach((segment, index) => groups[Math.min(2, Math.floor((index * 3) / segments.length))]?.push(topicSegmentToken(segment.id)));
  return JSON.stringify({
    topics: [
      { title: "Processos", description: "Estados, contextos e recursos associados à execução de processos.", segmentIds: groups[0] },
      { title: "Escalonamento de CPU", description: "Seleção de tarefas prontas e distribuição do tempo de processamento.", segmentIds: groups[1] },
      { title: "Sincronização concorrente", description: "Coordenação do acesso a recursos compartilhados com mutexes e semáforos.", segmentIds: groups[2] },
    ],
  });
}

test("parses 3-12 grounded topics and returns ordered exact ranges", () => {
  const topics = parseTopicDiscoveryResponse(validOutput(), source, segments);
  assert.equal(topics.length, 3);
  assert.deepEqual(topics.map((topic) => topic.position), [1, 2, 3]);
  assert.ok(topics.every((topic) => topic.sourceRanges.length > 0));
});

test("accepts a JSON Markdown fence but rejects malformed output", () => {
  assert.equal(parseTopicDiscoveryResponse(`\`\`\`json\n${validOutput()}\n\`\`\``, source, segments).length, 3);
  assert.throws(() => parseTopicDiscoveryResponse("not json", source, segments), /MALFORMED_TOPIC_OUTPUT/u);
});

test("rejects unknown segment IDs", () => {
  const parsed = JSON.parse(validOutput());
  parsed.topics[0].segmentIds[0] = "SEG:S999";
  assert.throws(() => parseTopicDiscoveryResponse(JSON.stringify(parsed), source, segments), /UNKNOWN_TOPIC_SEGMENT/u);
  parsed.topics[0].segmentIds[0] = "S001";
  assert.throws(() => parseTopicDiscoveryResponse(JSON.stringify(parsed), source, segments), /INVALID_TOPIC_OUTPUT/u);
});

test("rejects duplicate and near-duplicate topic titles", () => {
  const parsed = JSON.parse(validOutput());
  parsed.topics[1].title = "Processos!";
  assert.throws(() => parseTopicDiscoveryResponse(JSON.stringify(parsed), source, segments), /DUPLICATE_TOPIC_TITLE/u);
});

test("rejects overlap across topics and insufficient coverage", () => {
  const duplicate = JSON.parse(validOutput());
  duplicate.topics[0].segmentIds.push(duplicate.topics[0].segmentIds[0]);
  assert.throws(() => parseTopicDiscoveryResponse(JSON.stringify(duplicate), source, segments), /DUPLICATE_TOPIC_SEGMENT/u);

  const overlap = JSON.parse(validOutput());
  overlap.topics[1].segmentIds.push(overlap.topics[0].segmentIds[0]);
  assert.throws(() => parseTopicDiscoveryResponse(JSON.stringify(overlap), source, segments), /OVERLAPPING_DOCUMENT_TOPICS/u);

  const missing = JSON.parse(validOutput());
  const groupWithMoreThanOneSegment = missing.topics.find((topic: { segmentIds: string[] }) => topic.segmentIds.length > 1);
  assert.ok(groupWithMoreThanOneSegment);
  groupWithMoreThanOneSegment.segmentIds.pop();
  assert.throws(() => parseTopicDiscoveryResponse(JSON.stringify(missing), source, segments), /INSUFFICIENT_TOPIC_COVERAGE/u);
});

test("rejects ranges outside the persisted source and topics with too little grounding", () => {
  const invalidSegments = segments.map((segment, index) => index === 0 ? { ...segment, end: Array.from(source).length + 1 } : segment);
  assert.throws(
    () => parseTopicDiscoveryResponse(validOutput(), source, invalidSegments),
    /INVALID_TOPIC_SOURCE_RANGE/u,
  );

  const tinySource = "um dois três quatro cinco seis sete oito nove dez";
  const tinySegments = [
    { id: "S001", start: 0, end: 10, text: "um dois" },
    { id: "S002", start: 10, end: 25, text: "três quatro" },
    { id: "S003", start: 25, end: Array.from(tinySource).length, text: "cinco seis" },
  ];
  const tinyOutput = JSON.stringify({ topics: [
    { title: "Tema um", description: "Uma descrição acadêmica suficientemente longa.", segmentIds: ["SEG:S001"] },
    { title: "Tema dois", description: "Outra descrição acadêmica suficientemente longa.", segmentIds: ["SEG:S002"] },
    { title: "Tema três", description: "Terceira descrição acadêmica suficientemente longa.", segmentIds: ["SEG:S003"] },
  ] });
  assert.throws(() => parseTopicDiscoveryResponse(tinyOutput, tinySource, tinySegments), /TOPIC_SOURCE_TOO_SHORT/u);
});
