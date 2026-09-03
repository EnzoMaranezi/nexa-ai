import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runOverviewLoad, type OverviewLoadState } from "./overview-load-state.ts";

const overviewUi = readFileSync(new URL("../routes/app.index.tsx", import.meta.url), "utf8");

function createHarness<T>(request: () => Promise<T>) {
  const states: OverviewLoadState<T>[] = [];
  const errors: unknown[] = [];
  const inFlight = { current: false };

  return {
    states,
    errors,
    run: () =>
      runOverviewLoad({
        request,
        setState: (state) => states.push(state),
        inFlight,
        onFailure: (error) => errors.push(error),
      }),
  };
}

test("Overview begins in loading and reaches success after a successful request", async () => {
  const harness = createHarness(async () => ({ sessions: 1 }));

  assert.equal(await harness.run(), "success");
  assert.deepEqual(harness.states, [
    { status: "loading", data: null },
    { status: "success", data: { sessions: 1 } },
  ]);
});

test("a failed Overview request reaches a terminal error state instead of loading", async () => {
  const harness = createHarness(async () => {
    throw new Error("database unavailable");
  });

  assert.equal(await harness.run(), "error");
  assert.deepEqual(harness.states, [
    { status: "loading", data: null },
    { status: "error", data: null },
  ]);
  assert.equal(harness.errors.length, 1);
});

test("retry starts a new Overview request and can recover from a failure", async () => {
  let calls = 0;
  const harness = createHarness(async () => {
    calls += 1;
    if (calls === 1) throw new Error("temporary failure");
    return { sessions: 2 };
  });

  assert.equal(await harness.run(), "error");
  assert.equal(await harness.run(), "success");
  assert.equal(calls, 2);
  assert.deepEqual(harness.states.at(-1), { status: "success", data: { sessions: 2 } });
});

test("a duplicate retry is ignored while an Overview request is loading", async () => {
  let resolveRequest: ((value: { sessions: number }) => void) | undefined;
  let calls = 0;
  const harness = createHarness(
    () =>
      new Promise<{ sessions: number }>((resolve) => {
        calls += 1;
        resolveRequest = resolve;
      }),
  );

  const first = harness.run();
  assert.equal(await harness.run(), "in-flight");
  assert.equal(calls, 1);

  resolveRequest?.({ sessions: 3 });
  assert.equal(await first, "success");
});

test("the Overview route replaces progress skeletons with a retryable terminal error", () => {
  assert.match(overviewUi, /const overviewFailed = overviewLoadState\.status === "error"/);
  assert.match(
    overviewUi,
    /overviewFailed \? \([\s\S]*<ErrorState body=\{t\("overview\.loadError"\)\} onRetry=\{loadOverview\}/,
  );
  assert.match(overviewUi, /\{!overviewFailed && \([\s\S]*<section aria-labelledby="overview-heading"/);
  assert.doesNotMatch(overviewUi, /getProgressOverview\(\)[\s\S]*\.catch\(\(\) => \{\}\)/);
});
