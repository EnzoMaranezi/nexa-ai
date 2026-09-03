export interface SessionScope {
  kind: string;
  topicId: string | null;
  topicScopeId: string | null;
  topicTitle: string | null;
}

export interface StudySessionListItem extends SessionScope {
  id: string;
  documentId: string;
  documentTitle: string | null;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number;
  completedAt: string | null;
}

export interface ProgressOverview {
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
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

export interface ProgressSessionRow {
  id: string;
  document_id: string;
  total_questions: number;
  correct_answers: number;
  accuracy: number;
  completed_at: string | null;
  documents: { title: string } | null;
  question_sets?: {
    kind: string;
    topic_id: string | null;
    topic_scope_id: string | null;
    document_topics: { id: string; title: string } | null;
  } | null;
}

export function mapSession(row: ProgressSessionRow): StudySessionListItem {
  const set = row.question_sets;
  const topicScopeId = set?.topic_scope_id ?? set?.topic_id ?? null;
  const topic = set?.document_topics;
  // Only current, visible topic metadata can provide a navigation target.
  const topicId =
    topic && topic.id === set?.topic_id && topic.id === topicScopeId ? topic.id : null;

  return {
    id: row.id,
    documentId: row.document_id,
    documentTitle: row.documents?.title ?? null,
    totalQuestions: row.total_questions,
    correctAnswers: row.correct_answers,
    incorrectAnswers: Math.max(row.total_questions - row.correct_answers, 0),
    accuracy: Number(row.accuracy),
    completedAt: row.completed_at,
    kind: set?.kind ?? "legacy",
    topicId,
    topicScopeId,
    topicTitle: topicId ? topic!.title : null,
  };
}

export function buildProgressOverview({
  completedRows,
  activeRow,
  materialsTotal,
}: {
  completedRows: ProgressSessionRow[];
  activeRow: ProgressSessionRow | null;
  materialsTotal: number;
}): ProgressOverview {
  const sessions = completedRows.map(mapSession);
  const totalQuestions = sessions.reduce((sum, session) => sum + session.totalQuestions, 0);
  const totalCorrect = sessions.reduce((sum, session) => sum + session.correctAnswers, 0);
  const byMaterial = new Map<string, ProgressOverview["perMaterial"][number]>();

  for (const session of sessions) {
    const entry = byMaterial.get(session.documentId) ?? {
      documentId: session.documentId,
      documentTitle: session.documentTitle,
      sessions: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      accuracy: 0,
    };
    entry.sessions += 1;
    entry.totalQuestions += session.totalQuestions;
    entry.totalCorrect += session.correctAnswers;
    entry.accuracy =
      entry.totalQuestions > 0
        ? Math.round((entry.totalCorrect / entry.totalQuestions) * 100)
        : 0;
    byMaterial.set(session.documentId, entry);
  }

  return {
    totalSessions: sessions.length,
    totalQuestions,
    totalCorrect,
    overallAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    materialsStudied: byMaterial.size,
    materialsTotal,
    activeSession: activeRow ? mapSession(activeRow) : null,
    recent: sessions.slice(0, 5),
    perMaterial: [...byMaterial.values()].sort((a, b) => b.sessions - a.sessions),
  };
}
