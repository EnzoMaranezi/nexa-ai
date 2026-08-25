export type Difficulty = "easy" | "medium" | "hard";

export interface Concept {
  id: string;
  title: string;
  context?: string | undefined;
  difficulty: Difficulty;
  mastery: number;
  parent?: string | undefined;
}

export interface WeakArea {
  title: string;
  confidence: number;
  reason: string;
}

export type QuestionKind = "open" | "multiple-choice" | "true-false" | "flashcard";

export interface Question {
  id: string;
  kind: QuestionKind;
  question: string;
  answer: string;
  explanation: string;
  difficulty: Difficulty;
  options?: string[] | undefined;
  concept?: string | undefined;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface SessionBlock {
  index: string;
  title: string;
  detail: string;
  minutes: number;
}

export interface RecommendedSession {
  minutes: number;
  blocks: SessionBlock[];
}

export interface StudyAnalysis {
  id: string;
  documentId?: string | undefined;
  title: string;
  subject: string;
  chapter: string;
  summary: string;
  createdAt: number;
  concepts: Concept[];
  weakAreas: WeakArea[];
  questions: Question[];
  flashcards: Flashcard[];
  recommendedSession: RecommendedSession;
}

export interface MaterialRecord {
  id: string;
  name: string;
  subject: string;
  chapter: string;
  concepts: number;
  lastStudied: string;
  progress: number;
  source: "upload" | "notes" | "sample";
  sizeLabel?: string | undefined;
  type?: string | undefined;
}

export interface AnswerFeedback {
  verdict: "correct" | "partial" | "incorrect";
  headline: string;
  body: string;
  missing?: string | undefined;
  confidence: number;
}

export interface SessionResult {
  analysisId: string;
  subject: string;
  chapter: string;
  score: number;
  answered: number;
  conceptsReinforced: number;
  weakAreas: string[];
  strong: string[];
  completedAt: number;
}

export interface SessionProgress {
  analysisId: string;
  index: number;
  correct: number;
  answered: number;
}
