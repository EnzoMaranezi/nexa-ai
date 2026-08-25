import assert from "node:assert/strict";
import test from "node:test";
import {
  AI_PROVIDERS_UNAVAILABLE,
  runAiProviderChain,
  type AiProviderAttempt,
} from "./ai-provider-chain.ts";

const attempts: AiProviderAttempt[] = [
  { provider: "nvidia", model: "meta/llama-3.1-8b-instruct", label: "nvidia-primary" },
  { provider: "nvidia", model: "meta/llama-3.3-70b-instruct", label: "nvidia-fallback" },
  { provider: "openrouter", model: "configured-model", label: "openrouter-fallback" },
];

function providerError(statusCode: number, message = "provider unavailable") {
  const error = Object.assign(new Error(message), { statusCode });
  return error;
}

test("uses NVIDIA primary without fallback", async () => {
  const called: string[] = [];
  const result = await runAiProviderChain({
    attempts,
    generate: async (attempt) => {
      called.push(attempt.label);
      return "primary output";
    },
  });

  assert.equal(result, "primary output");
  assert.deepEqual(called, ["nvidia-primary"]);
});

test("uses NVIDIA fallback after a transient primary failure", async () => {
  const called: string[] = [];
  const result = await runAiProviderChain({
    attempts,
    generate: async (attempt) => {
      called.push(attempt.label);
      if (attempt.label === "nvidia-primary") throw providerError(503);
      return "nvidia fallback output";
    },
  });

  assert.equal(result, "nvidia fallback output");
  assert.deepEqual(called, ["nvidia-primary", "nvidia-fallback"]);
});

test("uses NVIDIA fallback when the primary model is not found", async () => {
  const called: string[] = [];
  const result = await runAiProviderChain({
    attempts,
    generate: async (attempt) => {
      called.push(attempt.label);
      if (attempt.label === "nvidia-primary") throw providerError(404, "Not Found");
      return "nvidia fallback output";
    },
  });

  assert.equal(result, "nvidia fallback output");
  assert.deepEqual(called, ["nvidia-primary", "nvidia-fallback"]);
});

test("uses OpenRouter after both NVIDIA models are transiently unavailable", async () => {
  const called: string[] = [];
  const result = await runAiProviderChain({
    attempts,
    generate: async (attempt) => {
      called.push(attempt.label);
      if (attempt.provider === "nvidia") throw providerError(503);
      return "openrouter output";
    },
  });

  assert.equal(result, "openrouter output");
  assert.deepEqual(called, ["nvidia-primary", "nvidia-fallback", "openrouter-fallback"]);
});

test("returns the stable unavailable code only after all providers fail transiently", async () => {
  await assert.rejects(
    runAiProviderChain({
      attempts,
      generate: async () => {
        throw providerError(503);
      },
    }),
    new Error(AI_PROVIDERS_UNAVAILABLE),
  );
});

test("does not fallback after a non-retryable provider error", async () => {
  const called: string[] = [];
  await assert.rejects(
    runAiProviderChain({
      attempts,
      generate: async (attempt) => {
        called.push(attempt.label);
        throw providerError(400, "invalid request");
      },
    }),
    /invalid request/,
  );
  assert.deepEqual(called, ["nvidia-primary"]);
});

test("does not invoke fallback after a provider has returned text that later fails parsing", async () => {
  const called: string[] = [];
  const text = await runAiProviderChain({
    attempts,
    generate: async (attempt) => {
      called.push(attempt.label);
      return "malformed markdown";
    },
  });

  assert.throws(() => {
    if (text === "malformed markdown") throw new Error("parser failure");
  }, /parser failure/);
  assert.deepEqual(called, ["nvidia-primary"]);
});
