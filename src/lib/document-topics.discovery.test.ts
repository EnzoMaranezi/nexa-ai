import assert from "node:assert/strict";
import test from "node:test";
import { runCachedTopicDiscovery } from "./document-topics.discovery.ts";

test("two concurrent discoveries use one reservation, one provider call, and one persisted result", async () => {
  let cache: string[] | null = null;
  let reservationActive = false;
  let reservations = 0;
  let providerCalls = 0;
  let persistenceCalls = 0;
  const finished: string[] = [];

  const run = () => runCachedTopicDiscovery({
    loadCached: async () => cache,
    reserve: async () => {
      if (reservationActive) throw new Error("AI_GENERATION_IN_PROGRESS");
      reservationActive = true;
      reservations += 1;
      return "reservation";
    },
    generate: async () => {
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return "provider output";
    },
    persist: async () => {
      persistenceCalls += 1;
      cache = ["topic-a", "topic-b", "topic-c"];
      return cache;
    },
    finish: async (_reservation, status) => {
      finished.push(status);
      reservationActive = false;
    },
    isGenerationInProgress: (error) => error instanceof Error && error.message.includes("AI_GENERATION_IN_PROGRESS"),
    waitForCached: async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (cache) return cache;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      return null;
    },
  });

  const [first, second] = await Promise.all([run(), run()]);
  assert.equal(reservations, 1);
  assert.equal(providerCalls, 1);
  assert.equal(persistenceCalls, 1);
  assert.deepEqual(finished, ["succeeded"]);
  assert.deepEqual(first.value, second.value);
  assert.equal([first.reused, second.reused].filter(Boolean).length, 1);
});

test("cached topics use zero quota and zero provider calls", async () => {
  let reserved = false;
  let generated = false;
  const result = await runCachedTopicDiscovery({
    loadCached: async () => ["cached"],
    reserve: async () => { reserved = true; return "reservation"; },
    generate: async () => { generated = true; return "output"; },
    persist: async () => ["saved"],
    finish: async () => undefined,
    isGenerationInProgress: () => false,
    waitForCached: async () => null,
  });
  assert.equal(result.reused, true);
  assert.equal(reserved, false);
  assert.equal(generated, false);
});

test("provider failure releases the single reservation", async () => {
  const finished: string[] = [];
  await assert.rejects(
    runCachedTopicDiscovery({
      loadCached: async () => null,
      reserve: async () => "reservation",
      generate: async () => { throw new Error("AI_PROVIDERS_UNAVAILABLE"); },
      persist: async () => ["saved"],
      finish: async (_reservation, status) => { finished.push(status); },
      isGenerationInProgress: () => false,
      waitForCached: async () => null,
    }),
    /AI_PROVIDERS_UNAVAILABLE/u,
  );
  assert.deepEqual(finished, ["failed"]);
});

test("malformed returned output still consumes the reservation", async () => {
  const finished: string[] = [];
  await assert.rejects(
    runCachedTopicDiscovery({
      loadCached: async () => null,
      reserve: async () => "reservation",
      generate: async () => "malformed returned text",
      persist: async () => { throw new Error("TOPIC_OUTPUT_INVALID"); },
      finish: async (_reservation, status) => { finished.push(status); },
      isGenerationInProgress: () => false,
      waitForCached: async () => null,
    }),
    /TOPIC_OUTPUT_INVALID/u,
  );
  assert.deepEqual(finished, ["succeeded"]);
});
