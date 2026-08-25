import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildFlashcardReviewOverview,
  type FlashcardOverviewCardRow,
  type FlashcardOverviewSetRow,
  type FlashcardReviewOverview,
} from "@/lib/flashcards.overview";
import { getUserLocale } from "@/lib/i18n";

export const getFlashcardReviewOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FlashcardReviewOverview> => {
    const { supabase } = context;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw new Error("Unable to load the authenticated user's language preference.");
    }
    const locale = getUserLocale(authData.user.user_metadata);
    const { data: setRows, error: setsError } = await supabase
      .from("flashcard_sets")
      .select("id, document_id, locale, documents!inner(title)")
      .eq("locale", locale)
      .order("document_id");

    if (setsError) throw new Error(setsError.message);

    const sets: FlashcardOverviewSetRow[] = (setRows ?? []).map((row) => ({
      id: row.id,
      documentId: row.document_id,
      documentTitle: (row.documents as { title: string }).title,
      locale,
    }));

    if (sets.length === 0) {
      return buildFlashcardReviewOverview({ locale, sets, cards: [] });
    }

    const { data: cardRows, error: cardsError } = await supabase
      .from("flashcards")
      .select("flashcard_set_id, due_at")
      .in(
        "flashcard_set_id",
        sets.map((set) => set.id),
      )
      .order("flashcard_set_id")
      .order("due_at");

    if (cardsError) throw new Error(cardsError.message);

    const cards: FlashcardOverviewCardRow[] = (cardRows ?? []).map((row) => ({
      flashcardSetId: row.flashcard_set_id,
      dueAt: row.due_at,
    }));

    return buildFlashcardReviewOverview({ locale, sets, cards });
  });
