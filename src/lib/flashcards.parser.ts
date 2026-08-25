import { flashcardDeckSchema, type Flashcard, type FlashcardDeck } from "./flashcards.schema.ts";

function clean(value: string) { return value.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "").trim(); }
function text(value: string) { return value.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").trim(); }
function key(value: string) { return value.toLocaleLowerCase().replace(/\s+/g, " ").trim(); }

export function parseMarkdownFlashcards(markdown: string): FlashcardDeck {
  const cards: Flashcard[] = [];
  const blocks = clean(markdown).split(/(?=^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:Card|Cartão|Cartao)\s+\d+\b)/gim);
  for (const block of blocks) {
    let front = ""; let back = ""; let target: "front" | "back" | null = null;
    for (const raw of block.split(/\r?\n/)) {
      const line = text(raw.replace(/^#{1,6}\s*/, "").replace(/^[-*]\s+/, ""));
      if (!line || /^(?:Card|Cartão|Cartao)\s+\d+\b/i.test(line)) continue;
      const frontMatch = /^(?:Front|Frente)\s*:\s*(.*)$/i.exec(line); const backMatch = /^(?:Back|Verso)\s*:\s*(.*)$/i.exec(line);
      if (frontMatch) { front = text(frontMatch[1] ?? ""); target = "front"; continue; }
      if (backMatch) { back = text(backMatch[1] ?? ""); target = "back"; continue; }
      if (target === "front") front = `${front} ${line}`.trim(); if (target === "back") back = `${back} ${line}`.trim();
    }
    if (front || back) cards.push({ front, back });
  }
  return flashcardDeckSchema.parse({ cards: cards.filter((card, index) => cards.findIndex((item) => key(item.front) === key(card.front)) === index) });
}

type DocumentRow = { id: string; user_id: string; title: string; extracted_text: string | null };
export function assertOwnedFlashcardDocument(doc: DocumentRow | null, userId: string): asserts doc is DocumentRow {
  if (!doc || doc.user_id !== userId) throw new Error("Document not found.");
}
