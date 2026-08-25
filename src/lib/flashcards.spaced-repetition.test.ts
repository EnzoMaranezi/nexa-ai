import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type Rating = "again" | "hard" | "good" | "easy";
type State = { dueAt: number; ease: number; interval: number; repetitions: number };

const migration = readFileSync(new URL("../../supabase/migrations/0005_flashcard_spaced_repetition.sql", import.meta.url), "utf8");
const phaseOneMigration = readFileSync(new URL("../../supabase/migrations/0004_flashcards.sql", import.meta.url), "utf8");
const functionsSource = readFileSync(new URL("./flashcards.functions.ts", import.meta.url), "utf8");
const componentSource = readFileSync(new URL("../components/app/DocumentFlashcards.tsx", import.meta.url), "utf8");
const i18nSource = readFileSync(new URL("./i18n.tsx", import.meta.url), "utf8");

function roundedEase(value: number) {
  return Math.round(value * 100) / 100;
}

function schedule(previous: State, rating: Rating | string, now: number) {
  if (!["again", "hard", "good", "easy"].includes(rating)) throw new Error("UNSUPPORTED_FLASHCARD_RATING");
  if (previous.dueAt > now) throw new Error("FLASHCARD_NOT_DUE");

  let interval = previous.interval;
  let repetitions = previous.repetitions;
  let ease = previous.ease;
  let nextDueAt = now;

  if (rating === "again") {
    interval = 0;
    repetitions = 0;
    ease = Math.max(1.3, roundedEase(previous.ease - 0.2));
    nextDueAt = now + 10 * 60_000;
  } else if (rating === "hard") {
    if (previous.repetitions === 0) {
      interval = 0;
      repetitions = 0;
      nextDueAt = now + 12 * 60 * 60_000;
    } else {
      interval = Math.max(1, Math.ceil(previous.interval * 1.2));
      repetitions += 1;
      ease = Math.max(1.3, roundedEase(previous.ease - 0.15));
      nextDueAt = now + interval * 86_400_000;
    }
  } else if (rating === "good") {
    interval = previous.repetitions === 0 ? 1 : previous.repetitions === 1 ? 3 : Math.max(1, Math.round(previous.interval * previous.ease));
    repetitions += 1;
    nextDueAt = now + interval * 86_400_000;
  } else {
    ease = Math.min(3, roundedEase(previous.ease + 0.15));
    interval = previous.repetitions === 0 ? 3 : Math.max(1, Math.round(previous.interval * ease * 1.3));
    repetitions += 1;
    nextDueAt = now + interval * 86_400_000;
  }

  return {
    state: { dueAt: nextDueAt, ease, interval, repetitions },
    history: {
      previousDueAt: previous.dueAt,
      nextDueAt,
      previousInterval: previous.interval,
      nextInterval: interval,
      reviewedAt: now,
      rating,
    },
  };
}

const NOW = Date.UTC(2026, 7, 24, 12);
const newCard = (): State => ({ dueAt: NOW, ease: 2.5, interval: 0, repetitions: 0 });

test("migration keeps Phase 1 cards and initializes scheduling defaults", () => {
  assert.match(migration, /ALTER TABLE public\.flashcards/);
  assert.match(migration, /due_at timestamp with time zone NOT NULL DEFAULT now\(\)/);
  assert.match(migration, /last_reviewed_at timestamp with time zone/);
  assert.match(migration, /interval_days integer NOT NULL DEFAULT 0/);
  assert.match(migration, /repetitions integer NOT NULL DEFAULT 0/);
  assert.match(migration, /ease_factor numeric\(3, 2\) NOT NULL DEFAULT 2\.50/);
  assert.doesNotMatch(migration, /UPDATE public\.flashcards\s+SET\s+(front|back)/i);
});

test("new card ratings follow the approved learning steps", () => {
  assert.deepEqual(schedule(newCard(), "again", NOW).state, { dueAt: NOW + 600_000, ease: 2.3, interval: 0, repetitions: 0 });
  assert.deepEqual(schedule(newCard(), "hard", NOW).state, { dueAt: NOW + 43_200_000, ease: 2.5, interval: 0, repetitions: 0 });
  assert.deepEqual(schedule(newCard(), "good", NOW).state, { dueAt: NOW + 86_400_000, ease: 2.5, interval: 1, repetitions: 1 });
  assert.deepEqual(schedule(newCard(), "easy", NOW).state, { dueAt: NOW + 259_200_000, ease: 2.65, interval: 3, repetitions: 1 });
});

test("Good progression is 1, 3, then ease-based", () => {
  const first = schedule(newCard(), "good", NOW).state;
  const second = schedule(first, "good", first.dueAt).state;
  const third = schedule(second, "good", second.dueAt).state;
  assert.deepEqual([first.interval, second.interval, third.interval], [1, 3, 8]);
  assert.deepEqual([first.repetitions, second.repetitions, third.repetitions], [1, 2, 3]);
});

test("repeated Hard keeps a learning card on twelve-hour steps", () => {
  const first = schedule(newCard(), "hard", NOW).state;
  const second = schedule(first, "hard", first.dueAt).state;
  assert.deepEqual(
    [first.interval, first.repetitions, first.ease, second.interval, second.repetitions, second.ease],
    [0, 0, 2.5, 0, 0, 2.5],
  );
  assert.equal(second.dueAt, first.dueAt + 43_200_000);
});

test("mature Hard and Easy use deterministic interval and ease changes", () => {
  const mature: State = { dueAt: NOW, ease: 2.5, interval: 8, repetitions: 3 };
  const hard = schedule(mature, "hard", NOW).state;
  const easy = schedule({ ...mature, interval: 3 }, "easy", NOW).state;
  assert.deepEqual({ interval: hard.interval, repetitions: hard.repetitions, ease: hard.ease }, { interval: 10, repetitions: 4, ease: 2.35 });
  assert.deepEqual({ interval: easy.interval, repetitions: easy.repetitions, ease: easy.ease }, { interval: 10, repetitions: 4, ease: 2.65 });
});

test("Again resets progress and ease remains within its lower bound", () => {
  let state: State = { dueAt: NOW, ease: 1.35, interval: 20, repetitions: 5 };
  state = schedule(state, "again", NOW).state;
  assert.deepEqual({ interval: state.interval, repetitions: state.repetitions, ease: state.ease }, { interval: 0, repetitions: 0, ease: 1.3 });
});

test("Easy ease remains within its upper bound", () => {
  const state = schedule({ dueAt: NOW, ease: 2.95, interval: 10, repetitions: 3 }, "easy", NOW).state;
  assert.equal(state.ease, 3);
});

test("repeated Easy uses updated ease and caps it at three", () => {
  const first = schedule(newCard(), "easy", NOW).state;
  const second = schedule(first, "easy", first.dueAt).state;
  const third = schedule(second, "easy", second.dueAt).state;
  const fourth = schedule(third, "easy", third.dueAt).state;
  assert.deepEqual([first.interval, second.interval, third.interval, fourth.interval], [3, 11, 42, 164]);
  assert.deepEqual([first.ease, second.ease, third.ease, fourth.ease], [2.65, 2.8, 2.95, 3]);
});

test("Good after an Again learning step restarts at one day", () => {
  const again = schedule({ dueAt: NOW, ease: 2.5, interval: 20, repetitions: 5 }, "again", NOW).state;
  const good = schedule(again, "good", again.dueAt).state;
  assert.deepEqual({ interval: good.interval, repetitions: good.repetitions, ease: good.ease }, { interval: 1, repetitions: 1, ease: 2.3 });
});

test("history records the exact schedule transition", () => {
  const result = schedule(newCard(), "good", NOW);
  assert.deepEqual(result.history, {
    previousDueAt: NOW,
    nextDueAt: NOW + 86_400_000,
    previousInterval: 0,
    nextInterval: 1,
    reviewedAt: NOW,
    rating: "good",
  });
});

test("overdue cards schedule from review time and early or unsupported reviews fail", () => {
  const overdue = schedule({ ...newCard(), dueAt: NOW - 7 * 86_400_000 }, "good", NOW).state;
  assert.equal(overdue.dueAt, NOW + 86_400_000);
  assert.throws(() => schedule({ ...newCard(), dueAt: NOW + 1 }, "good", NOW), /FLASHCARD_NOT_DUE/);
  assert.throws(() => schedule(newCard(), "perfect", NOW), /UNSUPPORTED_FLASHCARD_RATING/);
});

test("migration enforces auth, ownership, immutable history, and safe RPC grants", () => {
  assert.match(migration, /IF v_user_id IS NULL[\s\S]*AUTH_REQUIRED/);
  assert.match(migration, /card_set\.user_id = v_user_id/);
  assert.match(migration, /FLASHCARD_NOT_FOUND/);
  assert.match(migration, /REVOKE ALL ON public\.flashcard_reviews FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON public\.flashcard_reviews FROM anon/);
  assert.match(migration, /REVOKE ALL ON public\.flashcard_reviews FROM authenticated/);
  assert.match(migration, /GRANT SELECT ON public\.flashcard_reviews TO authenticated/);
  assert.doesNotMatch(migration, /GRANT (INSERT|UPDATE|DELETE).*flashcard_reviews TO authenticated/i);
  assert.match(migration, /USING \(user_id = auth\.uid\(\)\)/);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path = pg_catalog, public/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.review_flashcard\(uuid, text\) FROM PUBLIC/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.review_flashcard\(uuid, text\) FROM anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.review_flashcard\(uuid, text\) TO authenticated/);
});

test("RPC serializes and rejects duplicate reviews after the first transition", () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(v_user_id::text\), hashtext\(p_flashcard_id::text\)\)/);
  assert.match(migration, /FOR UPDATE OF card/);
  assert.match(migration, /IF v_previous_due_at > v_now[\s\S]*FLASHCARD_NOT_DUE/);
  const first = schedule(newCard(), "good", NOW).state;
  assert.throws(() => schedule(first, "good", NOW), /FLASHCARD_NOT_DUE/);
});

test("card transition and history insertion share one atomic RPC body", () => {
  const updateIndex = migration.indexOf("UPDATE public.flashcards");
  const historyIndex = migration.indexOf("INSERT INTO public.flashcard_reviews");
  const functionEnd = migration.indexOf("$$;", historyIndex);
  assert.ok(updateIndex >= 0 && historyIndex > updateIndex && functionEnd > historyIndex);
  assert.doesNotMatch(migration.slice(updateIndex, functionEnd), /BEGIN\s*;|COMMIT\s*;/i);
});

test("Phase 1 ownership grants remain read-only and deletion cascades through review history", () => {
  assert.match(phaseOneMigration, /REVOKE ALL ON public\.flashcard_sets, public\.flashcards FROM authenticated/);
  assert.match(phaseOneMigration, /GRANT SELECT ON public\.flashcard_sets, public\.flashcards TO authenticated/);
  assert.match(phaseOneMigration, /document_id uuid NOT NULL REFERENCES public\.documents\(id\) ON DELETE CASCADE/);
  assert.match(phaseOneMigration, /flashcard_set_id uuid NOT NULL REFERENCES public\.flashcard_sets\(id\) ON DELETE CASCADE/);
  assert.match(migration, /flashcard_id uuid NOT NULL REFERENCES public\.flashcards\(id\) ON DELETE CASCADE/);
  assert.match(migration, /user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
});

test("due queue is ownership-scoped, ordered, and returns the earliest future review", () => {
  assert.match(functionsSource, /from\("flashcard_sets"\)[\s\S]*eq\("document_id", documentId\)/);
  assert.match(functionsSource, /lte\("due_at", now\)[\s\S]*order\("due_at"\)[\s\S]*order\("position"\)/);
  assert.match(functionsSource, /gt\("due_at", now\)[\s\S]*order\("due_at"\)[\s\S]*limit\(1\)/);
  assert.match(functionsSource, /nextDueAt: nextCard\?\.due_at \?\? null/);
});

test("reviewing does not reserve quota or call an AI provider", () => {
  const reviewStart = functionsSource.indexOf("export const reviewFlashcard");
  const generationStart = functionsSource.indexOf("export const generateDocumentFlashcards");
  const reviewSource = functionsSource.slice(reviewStart, generationStart);
  assert.ok(reviewStart >= 0 && generationStart > reviewStart);
  assert.doesNotMatch(reviewSource, /reserveAiGeneration|generateAiText|runReservedAiGeneration/);
  assert.match(reviewSource, /p_flashcard_id: data\.flashcardId, p_rating: data\.rating/);
});

test("Review and Browse modes remain behaviorally separate", () => {
  assert.match(componentSource, /type FlashcardMode = "review" \| "browse"/);
  assert.match(componentSource, /mode === "review" && reviewCard/);
  assert.match(componentSource, /mode === "browse" && browseCard/);
  assert.match(componentSource, /revealed \? <div[\s\S]*rate\(rating\)/);
  const browseStart = componentSource.indexOf('mode === "browse" && browseCard');
  const browseEnd = componentSource.indexOf('mode === "browse" && complete');
  assert.doesNotMatch(componentSource.slice(browseStart, browseEnd), /rate\(|reviewFlashcard/);
});

test("English and PT-BR rating labels are present", () => {
  assert.match(i18nSource, /"flashcards\.ratingAgain": "Again"/);
  assert.match(i18nSource, /"flashcards\.ratingHard": "Hard"/);
  assert.match(i18nSource, /"flashcards\.ratingGood": "Good"/);
  assert.match(i18nSource, /"flashcards\.ratingEasy": "Easy"/);
  assert.match(i18nSource, /"flashcards\.ratingAgain": "Errei"/);
  assert.match(i18nSource, /"flashcards\.ratingHard": "Difícil"/);
  assert.match(i18nSource, /"flashcards\.ratingGood": "Bom"/);
  assert.match(i18nSource, /"flashcards\.ratingEasy": "Fácil"/);
});
