import assert from "node:assert/strict";
import test from "node:test";
import { assertOwnedFlashcardDocument, parseMarkdownFlashcards } from "./flashcards.parser.ts";

const validDeck = Array.from({ length: 12 }, (_, index) => `## Card ${index + 1}\nFront: What is concept ${index + 1}?\nBack: Concept ${index + 1} is supported by the material.`).join("\n\n");

test("parses a valid flashcard deck", () => {
  const deck = parseMarkdownFlashcards(validDeck);
  assert.equal(deck.cards.length, 12);
  assert.equal(deck.cards[0]?.front, "What is concept 1?");
});

test("rejects malformed flashcard output", () => {
  assert.throws(() => parseMarkdownFlashcards("## Card 1\nFront: Only one side"));
});

test("removes duplicate card prompts before validation", () => {
  const duplicate = validDeck.replace("What is concept 12?", "What is concept 1?");
  assert.equal(parseMarkdownFlashcards(duplicate).cards.length, 11);
});

test("rejects a document owned by another user", () => {
  assert.throws(() => assertOwnedFlashcardDocument({ id: "doc", user_id: "owner", title: "Material", extracted_text: "text" }, "attacker"), /Document not found/);
});
