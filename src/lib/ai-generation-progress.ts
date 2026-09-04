export type AiGenerationType = "summary" | "questions" | "flashcards" | "practice" | "topics";

export const AI_GENERATION_STAGE_INTERVAL_MS = 4_000;

export const aiGenerationStageKeys: Record<AiGenerationType, readonly string[]> = {
  summary: [
    "aiProgress.summary.preparing",
    "aiProgress.summary.analyzing",
    "aiProgress.summary.identifying",
    "aiProgress.summary.organizing",
    "aiProgress.summary.finalizing",
  ],
  questions: [
    "aiProgress.questions.preparing",
    "aiProgress.questions.analyzing",
    "aiProgress.questions.creating",
    "aiProgress.questions.checking",
    "aiProgress.questions.finalizing",
  ],
  flashcards: [
    "aiProgress.flashcards.preparing",
    "aiProgress.flashcards.identifying",
    "aiProgress.flashcards.creating",
    "aiProgress.flashcards.organizing",
    "aiProgress.flashcards.finalizing",
  ],
  practice: [
    "aiProgress.practice.reviewing",
    "aiProgress.practice.identifying",
    "aiProgress.practice.creating",
    "aiProgress.practice.checking",
    "aiProgress.practice.finalizing",
  ],
  topics: [
    "aiProgress.topics.preparing",
    "aiProgress.topics.analyzing",
    "aiProgress.topics.grouping",
    "aiProgress.topics.checking",
    "aiProgress.topics.finalizing",
  ],
};

export function aiGenerationStageIndex(type: AiGenerationType, elapsedMs: number) {
  const stages = aiGenerationStageKeys[type];
  return Math.min(Math.floor(Math.max(0, elapsedMs) / AI_GENERATION_STAGE_INTERVAL_MS), stages.length - 1);
}

type ProgressTimer = ReturnType<typeof setInterval>;
type TimerApi = {
  setInterval: (callback: () => void, delay: number) => ProgressTimer;
  clearInterval: (timer: ProgressTimer) => void;
};

/** Starts at once and stops once the final truthful status is visible. */
export function startAiGenerationProgress(
  type: AiGenerationType,
  onStage: (stageIndex: number) => void,
  timers: TimerApi = { setInterval, clearInterval },
) {
  const finalStage = aiGenerationStageKeys[type].length - 1;
  let stageIndex = 0;
  let stopped = false;
  let timer: ProgressTimer | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== undefined) timers.clearInterval(timer);
  };

  onStage(stageIndex);
  timer = timers.setInterval(() => {
    stageIndex = Math.min(stageIndex + 1, finalStage);
    onStage(stageIndex);
    if (stageIndex === finalStage) stop();
  }, AI_GENERATION_STAGE_INTERVAL_MS);

  return stop;
}
