import { z } from "zod";

export const flashcardSchema = z.object({
  front: z.string().trim().min(3).max(240),
  back: z.string().trim().min(3).max(800),
});

export const flashcardDeckSchema = z.object({
  cards: z.array(flashcardSchema).min(10).max(15),
});

export const flashcardRatingSchema = z.enum(["again", "hard", "good", "easy"]);

export type Flashcard = z.infer<typeof flashcardSchema>;
export type FlashcardDeck = z.infer<typeof flashcardDeckSchema>;
export type FlashcardRating = z.infer<typeof flashcardRatingSchema>;

export type StoredFlashcard = Flashcard & {
  id: string;
  position: number;
  dueAt: string;
  lastReviewedAt: string | null;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
};

export type FlashcardReviewResult = {
  flashcardId: string;
  rating: FlashcardRating;
  reviewedAt: string;
  nextDueAt: string;
  intervalDays: number;
  repetitions: number;
  easeFactor: number;
};
