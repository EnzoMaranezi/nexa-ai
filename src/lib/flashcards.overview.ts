import type { Locale, PersistedContentLocale } from "@/lib/i18n";

export interface FlashcardOverviewSetRow {
  id: string;
  documentId: string;
  documentTitle: string;
  topicId: string | null;
  topicTitle: string | null;
  locale: PersistedContentLocale;
}

export interface FlashcardOverviewCardRow {
  flashcardSetId: string;
  dueAt: string;
}

export interface DueFlashcardScope {
  flashcardSetId: string;
  documentId: string;
  documentTitle: string;
  topicId: string | null;
  topicTitle: string | null;
  dueCount: number;
  oldestDueAt: string;
}

export interface FlashcardReviewOverview {
  locale: Locale;
  hasDecks: boolean;
  totalDue: number;
  dueByScope: DueFlashcardScope[];
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
  const dueByScope = new Map<string, DueFlashcardScope>();
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

    const existing = dueByScope.get(set.id);
    if (existing) {
      existing.dueCount += 1;
      if (dueMs < Date.parse(existing.oldestDueAt)) existing.oldestDueAt = card.dueAt;
    } else {
      dueByScope.set(set.id, {
        flashcardSetId: set.id,
        documentId: set.documentId,
        documentTitle: set.documentTitle,
        topicId: set.topicId,
        topicTitle: set.topicTitle,
        dueCount: 1,
        oldestDueAt: card.dueAt,
      });
    }
  }

  const orderedScopes = [...dueByScope.values()].sort(
    (a, b) =>
      b.dueCount - a.dueCount ||
      Date.parse(a.oldestDueAt) - Date.parse(b.oldestDueAt) ||
      a.flashcardSetId.localeCompare(b.flashcardSetId),
  );

  return {
    locale,
    hasDecks: activeSets.length > 0,
    totalDue: orderedScopes.reduce((total, scope) => total + scope.dueCount, 0),
    dueByScope: orderedScopes,
    nextDueAt: Number.isFinite(nextDueMs) ? new Date(nextDueMs).toISOString() : null,
  };
}
