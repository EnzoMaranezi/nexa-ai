import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { nextPastedNoteTitle } from "./pasted-note-title.ts";

const documentService = readFileSync(new URL("./documentService.ts", import.meta.url), "utf8");
const i18nSource = readFileSync(new URL("../lib/i18n.tsx", import.meta.url), "utf8");

test("pasted notes use the localized base title first and add the next available suffix", () => {
  assert.equal(nextPastedNoteTitle("Pasted notes", []), "Pasted notes");
  assert.equal(nextPastedNoteTitle("Pasted notes", ["Pasted notes"]), "Pasted notes 2");
  assert.equal(
    nextPastedNoteTitle("Pasted notes", ["Pasted notes", "Pasted notes 2", "Pasted notes 3"]),
    "Pasted notes 4",
  );
  assert.equal(nextPastedNoteTitle("Notas coladas", ["Notas coladas"]), "Notas coladas 2");
});

test("pasted-note naming does not alter PDF filenames or existing materials", () => {
  assert.match(documentService, /title: file\.name/);
  assert.match(documentService, /nextPastedNoteTitle\(/);
  assert.match(documentService, /title: uniqueTitle/);
});

test("material deletion clearly discloses the related study data that will be removed", () => {
  assert.match(i18nSource, /generated study content, topics, question sessions, and flashcard review history/);
  assert.match(i18nSource, /conteúdo de estudo gerado, tópicos, sessões de perguntas e histórico de revisão de flashcards/);
});
