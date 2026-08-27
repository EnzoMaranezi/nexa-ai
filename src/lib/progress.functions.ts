import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SessionAnswer, StudyQuestion } from "@/lib/questions.schema";
import { runBoundedServerOperation } from "@/lib/bounded-server-operation";
import {
  buildProgressOverview,
  type ProgressOverview,
  type ProgressSessionRow,
  type StudySessionListItem,
} from "@/lib/progress-overview";

export type { ProgressOverview, StudySessionListItem } from "@/lib/progress-overview";

/** All completed sessions of the caller, most recent first (RLS scopes to owner). */
export const listStudySessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudySessionListItem[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("question_sessions")
      .select(
        "id, document_id, total_questions, correct_answers, accuracy, completed_at, documents(title)",
      )
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const doc = row.documents as { title: string } | null;
      return {
        id: row.id,
        documentId: row.document_id,
        documentTitle: doc?.title ?? null,
        totalQuestions: row.total_questions,
        correctAnswers: row.correct_answers,
        incorrectAnswers: Math.max(row.total_questions - row.correct_answers, 0),
        accuracy: Number(row.accuracy),
        completedAt: row.completed_at,
      };
    });
  });

export const getProgressOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressOverview> => {
    const { supabase } = context;

    const [sessionsRes, activeRes, docsRes] = await runBoundedServerOperation((signal) =>
      Promise.all([
        supabase
          .from("question_sessions")
          .select(
            "id, document_id, total_questions, correct_answers, accuracy, completed_at, documents(title)",
          )
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .abortSignal(signal),
        supabase
          .from("question_sessions")
          .select(
            "id, document_id, total_questions, correct_answers, accuracy, completed_at, documents(title)",
          )
          .is("completed_at", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .abortSignal(signal)
          .maybeSingle(),
        supabase.from("documents").select("id", { count: "exact", head: true }).abortSignal(signal),
      ]),
    );

    if (sessionsRes.error) throw new Error(sessionsRes.error.message);
    if (activeRes.error) throw new Error(activeRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);

    return buildProgressOverview({
      completedRows: (sessionsRes.data ?? []) as ProgressSessionRow[],
      activeRow: activeRes.data as ProgressSessionRow | null,
      materialsTotal: docsRes.count ?? 0,
    });
  });

export interface StudySessionDetail extends StudySessionListItem {
  answers: SessionAnswer[];
  questions: StudyQuestion[];
  documentExists: boolean;
  hasSummary: boolean;
}

/** Replays a stored session: recorded answers + the exact question set used. */
export const getStudySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<StudySessionDetail | null> => {
    const { supabase } = context;

    const { data: row, error } = await supabase
      .from("question_sessions")
      .select(
        "id, document_id, question_set_id, total_questions, correct_answers, accuracy, completed_at, answers, documents(title)",
      )
      .eq("id", data.sessionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return null;

    const doc = row.documents as { title: string } | null;

    let questions: StudyQuestion[] = [];
    if (row.question_set_id) {
      const { data: set } = await supabase
        .from("question_sets")
        .select("questions")
        .eq("id", row.question_set_id)
        .maybeSingle();
      if (set) questions = set.questions as unknown as StudyQuestion[];
    }

    let hasSummary = false;
    if (doc) {
      const { data: summary } = await supabase
        .from("summaries")
        .select("id")
        .eq("document_id", row.document_id)
        .limit(1)
        .maybeSingle();
      hasSummary = Boolean(summary);
    }

    return {
      id: row.id,
      documentId: row.document_id,
      documentTitle: doc?.title ?? null,
      totalQuestions: row.total_questions,
      correctAnswers: row.correct_answers,
      incorrectAnswers: Math.max(row.total_questions - row.correct_answers, 0),
      accuracy: Number(row.accuracy),
      completedAt: row.completed_at,
      answers: (row.answers as unknown as SessionAnswer[]) ?? [],
      questions,
      documentExists: Boolean(doc),
      hasSummary,
    };
  });
