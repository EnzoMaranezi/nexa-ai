import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AI_DAILY_LIMIT_REACHED, AI_GENERATION_IN_PROGRESS } from "@/lib/ai-errors";
import type { PersistedContentLocale } from "@/lib/i18n";

export type AiGenerationKind =
  | "summary"
  | "questions"
  | "practice_questions"
  | "flashcards"
  | "topic_discovery";

export interface AiGenerationReservation {
  id: string;
  usedCount: number;
  limitCount: number;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "";
}

function hasDailyLimitCode(error: unknown) {
  return errorMessage(error).includes(AI_DAILY_LIMIT_REACHED);
}

export function isAiDailyLimitError(error: unknown) {
  return error instanceof Error && error.message === AI_DAILY_LIMIT_REACHED;
}

export function isAiGenerationInProgressError(error: unknown) {
  return errorMessage(error).includes(AI_GENERATION_IN_PROGRESS);
}

export async function reserveAiGeneration(
  supabase: SupabaseClient<Database>,
  kind: AiGenerationKind,
  documentId: string,
  locale: PersistedContentLocale,
  topicId: string | null = null,
): Promise<AiGenerationReservation> {
  const { data, error } = await supabase.rpc("reserve_ai_generation", {
    p_kind: kind,
    p_document_id: documentId,
    p_locale: locale,
    p_topic_id: topicId,
  });

  if (error) {
    if (hasDailyLimitCode(error)) throw new Error(AI_DAILY_LIMIT_REACHED);
    throw new Error(error.message);
  }

  const row = data?.[0];
  if (!row) throw new Error("AI generation quota could not be reserved.");

  return {
    id: row.reservation_id,
    usedCount: row.used_count,
    limitCount: row.limit_count,
  };
}

export async function finishAiGeneration(
  supabase: SupabaseClient<Database>,
  reservationId: string,
  status: "succeeded" | "failed",
) {
  const { error } = await supabase.rpc("finish_ai_generation", {
    p_reservation_id: reservationId,
    p_status: status,
  });

  if (error) throw new Error(error.message);
}
