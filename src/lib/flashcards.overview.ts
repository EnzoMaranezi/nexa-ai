import type { Locale, PersistedContentLocale } from "@/lib/i18n";

export interface FlashcardOverviewSetRow {
  id: string;
  documentId: string;
  documentTitle: string;
  locale: PersistedContentLocale;
}

export interface FlashcardOverviewCardRow {
  flashcardSetId: string;
  dueAt: string;
}

export interface DueFlashcardDocument {
  documentId: string;
  documentTitle: string;
  dueCount: number;
  oldestDueAt: string;
}

export interface FlashcardReviewOverview {
  locale: Locale;
  hasDecks: boolean;
  totalDue: number;
  dueByDocument: DueFlashcardDocument[];
  nextDueAt: string | null;
}

export function buildFlashcardReviewOverview({
  locale,
  sets,
  cards,
  now = new Date(),
}: {
  locale: Locale;
  sets: FlashcardOverviewSetRow[];
  cards: FlashcardOverviewCardRow[];
  now?: Date;
}): FlashcardReviewOverview {
  const activeSets = sets.filter((set) => set.locale === locale);
  const setsById = new Map(activeSets.map((set) => [set.id, set]));
  const dueByDocument = new Map<string, DueFlashcardDocument>();
  const nowMs = now.getTime();
  let nextDueMs = Number.POSITIVE_INFINITY;

  for (const card of cards) {
    const set = setsById.get(card.flashcardSetId);
    if (!set) continue;

    const dueMs = Date.parse(card.dueAt);
    if (!Number.isFinite(dueMs)) continue;

    if (dueMs > nowMs) {
      nextDueMs = Math.min(nextDueMs, dueMs);
      continue;
    }

    const existing = dueByDocument.get(set.documentId);
    if (existing) {
      existing.dueCount += 1;
      if (dueMs < Date.parse(existing.oldestDueAt)) existing.oldestDueAt = card.dueAt;
    } else {
      dueByDocument.set(set.documentId, {
        documentId: set.documentId,
        documentTitle: set.documentTitle,
        dueCount: 1,
        oldestDueAt: card.dueAt,
      });
    }
  }

  const orderedDocuments = [...dueByDocument.values()].sort(
    (a, b) =>
      b.dueCount - a.dueCount ||
      Date.parse(a.oldestDueAt) - Date.parse(b.oldestDueAt) ||
      a.documentId.localeCompare(b.documentId),
  );

  return {
    locale,
    hasDecks: activeSets.length > 0,
    totalDue: orderedDocuments.reduce((total, document) => total + document.dueCount, 0),
    dueByDocument: orderedDocuments,
    nextDueAt: Number.isFinite(nextDueMs) ? new Date(nextDueMs).toISOString() : null,
  };
}
