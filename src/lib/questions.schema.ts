import { z } from "zod";

/** Multiple-choice study questions derived strictly from a document's extracted text. */
export const questionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
});

export const questionSetSchema = z.object({
  questions: z.array(questionSchema).length(5),
});

/** Practice sets are sized to the number of mistakes (1–5 questions). */
export const practiceQuestionSetSchema = z.object({
  questions: z.array(questionSchema).min(1).max(5),
});

/**
 * Stored/read shape. `topic` and `difficulty` are optional metadata slots kept
 * open for future analytics (weak topics, adaptive difficulty). Nothing writes
 * them yet — do not infer them.
 */
export const storedQuestionSchema = questionSchema.extend({
  topic: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export type StudyQuestion = z.infer<typeof storedQuestionSchema>;
export type StudyQuestionSet = z.infer<typeof questionSetSchema>;

/** One answered question inside a persisted session. */
export const sessionAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedIndex: z.number().int().min(0),
  correctIndex: z.number().int().min(0),
  correct: z.boolean(),
  answeredAt: z.string(),
});

export type SessionAnswer = z.infer<typeof sessionAnswerSchema>;

export type PerformanceBand =
  | "Excellent performance"
  | "Good performance"
  | "Consider reviewing the material"
  | "We recommend reviewing the material before another session";

export const performanceBandTranslationKeys: Record<PerformanceBand, string> = {
  "Excellent performance": "results.performance.excellent",
  "Good performance": "results.performance.good",
  "Consider reviewing the material": "results.performance.review",
  "We recommend reviewing the material before another session":
    "results.performance.reviewBeforeNext",
};

/** Shared classification so the result screen and stored results never diverge. */
export function classifyPerformance(accuracy: number): PerformanceBand {
  if (accuracy >= 90) return "Excellent performance";
  if (accuracy >= 70) return "Good performance";
  if (accuracy >= 50) return "Consider reviewing the material";
  return "We recommend reviewing the material before another session";
}
