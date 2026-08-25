import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SessionAnswer, StudyQuestion } from "@/lib/questions.schema";

export interface StudySessionListItem {
  id: string;
  documentId: string;
  documentTitle: string | null;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  completedAt: string | null;
}

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

export interface ProgressOverview {
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  /** total correct / total answered — never an average of session percentages. */
  overallAccuracy: number;
  materialsStudied: number;
  materialsTotal: number;
  activeSession: StudySessionListItem | null;
  recent: StudySessionListItem[];
  perMaterial: {
    documentId: string;
    documentTitle: string | null;
    sessions: number;
    totalQuestions: number;
    totalCorrect: number;
    accuracy: number;
  }[];
}

export const getProgressOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressOverview> => {
    const { supabase } = context;

    const [sessionsRes, activeRes, docsRes] = await Promise.all([
      supabase
        .from("question_sessions")
        .select(
          "id, document_id, total_questions, correct_answers, accuracy, completed_at, documents(title)",
        )
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false }),
      supabase
        .from("question_sessions")
        .select(
          "id, document_id, total_questions, correct_answers, accuracy, completed_at, documents(title)",
        )
        .is("completed_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("documents").select("id", { count: "exact", head: true }),
    ]);

    if (sessionsRes.error) throw new Error(sessionsRes.error.message);
    if (activeRes.error) throw new Error(activeRes.error.message);

    const sessions: StudySessionListItem[] = (sessionsRes.data ?? []).map((row) => {
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

    const totalQuestions = sessions.reduce((sum, s) => sum + s.totalQuestions, 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + s.correctAnswers, 0);

    const byMaterial = new Map<string, ProgressOverview["perMaterial"][number]>();
    for (const s of sessions) {
      const entry = byMaterial.get(s.documentId) ?? {
        documentId: s.documentId,
        documentTitle: s.documentTitle,
        sessions: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        accuracy: 0,
      };
      entry.sessions += 1;
      entry.totalQuestions += s.totalQuestions;
      entry.totalCorrect += s.correctAnswers;
      entry.accuracy =
        entry.totalQuestions > 0
          ? Math.round((entry.totalCorrect / entry.totalQuestions) * 100)
          : 0;
      byMaterial.set(s.documentId, entry);
    }

    return {
      totalSessions: sessions.length,
      totalQuestions,
      totalCorrect,
      overallAccuracy:
        totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      materialsStudied: byMaterial.size,
      materialsTotal: docsRes.count ?? 0,
      activeSession: activeRes.data
        ? {
            id: activeRes.data.id,
            documentId: activeRes.data.document_id,
            documentTitle: (activeRes.data.documents as { title: string } | null)?.title ?? null,
            totalQuestions: activeRes.data.total_questions,
            correctAnswers: activeRes.data.correct_answers,
            incorrectAnswers: Math.max(
              activeRes.data.total_questions - activeRes.data.correct_answers,
              0,
            ),
            accuracy: Number(activeRes.data.accuracy),
            completedAt: activeRes.data.completed_at,
          }
        : null,
      recent: sessions.slice(0, 5),
      perMaterial: [...byMaterial.values()].sort((a, b) => b.sessions - a.sessions),
    };
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
