import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AI_GENERATION_STAGE_INTERVAL_MS,
  aiGenerationStageIndex,
  aiGenerationStageKeys,
  startAiGenerationProgress,
} from "./ai-generation-progress.ts";

const i18nSource = readFileSync(new URL("./i18n.tsx", import.meta.url), "utf8");
const componentSource = readFileSync(
  new URL("../components/app/AiGenerationProgress.tsx", import.meta.url),
  "utf8",
);

test("every generation type has five truthful progress stages in both locales", () => {
  for (const [type, stages] of Object.entries(aiGenerationStageKeys)) {
    assert.equal(stages.length, 5, `${type} should have five stages`);
    for (const key of stages) {
      const matches = i18nSource.match(new RegExp(`"${key}":`, "g")) ?? [];
      assert.equal(matches.length, 2, `${key} must exist in English and pt-BR`);
    }
  }
});

test("the first stage is immediate and the final stage remains selected", () => {
  assert.equal(aiGenerationStageIndex("summary", 0), 0);
  assert.equal(aiGenerationStageIndex("summary", AI_GENERATION_STAGE_INTERVAL_MS), 1);
  assert.equal(aiGenerationStageIndex("summary", AI_GENERATION_STAGE_INTERVAL_MS * 20), 4);
});

test("the progress timer rotates stages, stops at the final stage, and cleans up", () => {
  const stages: number[] = [];
  let tick: (() => void) | undefined;
  let clearCalls = 0;
  const stop = startAiGenerationProgress(
    "practice",
    (stage) => stages.push(stage),
    {
      setInterval: (callback) => {
        tick = callback;
        return 1 as unknown as ReturnType<typeof setInterval>;
      },
      clearInterval: () => {
        clearCalls += 1;
      },
    },
  );

  assert.deepEqual(stages, [0]);
  for (let index = 0; index < 4; index += 1) tick?.();
  assert.deepEqual(stages, [0, 1, 2, 3, 4]);
  assert.equal(clearCalls, 1);
  stop();
  assert.equal(clearCalls, 1);
});

test("the default timer adapter keeps native browser timer methods bound to globalThis", () => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  let tick: (() => void) | undefined;
  let clearCalls = 0;

  globalThis.setInterval = function (this: typeof globalThis, callback: () => void) {
    assert.equal(this, globalThis);
    tick = callback;
    return 1 as unknown as ReturnType<typeof setInterval>;
  } as typeof globalThis.setInterval;
  globalThis.clearInterval = function (this: typeof globalThis, timer: ReturnType<typeof setInterval>) {
    assert.equal(this, globalThis);
    assert.equal(timer, 1);
    clearCalls += 1;
  } as typeof globalThis.clearInterval;

  try {
    const stop = startAiGenerationProgress("summary", () => {});
    tick?.();
    stop();
    assert.equal(clearCalls, 1);
  } finally {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

test("the shared UI is indeterminate and distinguishes waiting from provider progress", () => {
  assert.match(componentSource, /role="progressbar"/);
  assert.doesNotMatch(componentSource, /aria-valuenow|aria-valuemin|aria-valuemax/);
  assert.match(componentSource, /aiProgress\.waiting/);
});
