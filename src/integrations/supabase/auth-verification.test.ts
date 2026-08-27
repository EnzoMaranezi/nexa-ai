import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AUTH_VERIFICATION_UNAVAILABLE,
  createBoundedAuthFetch,
  runBoundedAuthVerification,
} from "./auth-verification.ts";

const middleware = readFileSync(new URL("./auth-middleware.ts", import.meta.url), "utf8");
const summaries = readFileSync(new URL("../../lib/summaries.functions.ts", import.meta.url), "utf8");
const progress = readFileSync(new URL("../../lib/progress.functions.ts", import.meta.url), "utf8");
const questions = readFileSync(new URL("../../lib/questions.functions.ts", import.meta.url), "utf8");
const flashcards = readFileSync(new URL("../../lib/flashcards.functions.ts", import.meta.url), "utf8");
const flashcardsOverview = readFileSync(new URL("../../lib/flashcards.overview.functions.ts", import.meta.url), "utf8");

test("verified auth succeeds without trusting decoded client claims", async () => {
  const claims = await runBoundedAuthVerification(async () => ({ sub: "verified-user", user_metadata: { locale: "pt-BR" } }));
  assert.equal(claims.sub, "verified-user");
  assert.equal(claims.user_metadata.locale, "pt-BR");
  assert.match(middleware, /supabase\.auth\.getClaims\(token\)/);
  assert.doesNotMatch(middleware, /decodeJwt|jwtDecode/);
});

test("a timed-out JWKS verification retries exactly once and then terminates", async () => {
  let calls = 0;
  await assert.rejects(
    runBoundedAuthVerification(
      async () => {
        calls += 1;
        await new Promise(() => undefined);
        return { sub: "never" };
      },
      { timeoutMs: 5, attempts: 2 },
    ),
    new RegExp(AUTH_VERIFICATION_UNAVAILABLE),
  );
  assert.equal(calls, 2);
});

test("the bounded JWKS fetch aborts the stalled network request", async () => {
  let aborted = false;
  const neverResolvingFetch = ((_: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(new DOMException("aborted", "AbortError"));
        },
        { once: true },
      );
    })) as typeof fetch;

  const boundedFetch = createBoundedAuthFetch(neverResolvingFetch, 5);
  await assert.rejects(boundedFetch("https://example.test/.well-known/jwks.json"), /aborted/);
  assert.equal(aborted, true);
});

test("a transient verification failure retries once while invalid and expired tokens are rejected", async () => {
  let transientCalls = 0;
  const verified = await runBoundedAuthVerification(
    async () => {
      transientCalls += 1;
      if (transientCalls === 1) throw new TypeError("fetch failed");
      return { sub: "verified" };
    },
    { timeoutMs: 5, attempts: 2 },
  );
  assert.equal(verified.sub, "verified");
  assert.equal(transientCalls, 2);

  for (const message of ["Invalid JWT signature", "JWT has expired", "Unknown signing key"]) {
    let calls = 0;
    await assert.rejects(
      runBoundedAuthVerification(
        async () => {
          calls += 1;
          throw new Error(message);
        },
        { timeoutMs: 5, attempts: 2 },
      ),
      new RegExp(message),
    );
    assert.equal(calls, 1);
  }
});

test("middleware bounds and aborts network auth verification before server handlers", () => {
  assert.match(middleware, /createBoundedAuthFetch\(fetch\)/);
  assert.match(middleware, /runBoundedAuthVerification/);
  assert.match(middleware, /AUTH_VERIFICATION_UNAVAILABLE/);
  assert.match(summaries, /runBoundedServerOperation/);
  assert.match(progress, /runBoundedServerOperation/);
});

test("locale remains derived from verified claims and the Supabase SDK owns JWKS caching", () => {
  assert.match(summaries, /getUserLocale\(claims\.user_metadata/);
  assert.doesNotMatch(summaries.slice(summaries.indexOf("getDocumentSummary"), summaries.indexOf("generateDocumentSummary")), /auth\.getUser\(/);
  assert.doesNotMatch(summaries, /getAiLocaleContext\(supabase\)/);
  assert.match(questions, /getAiLocaleContext\(claims\)/);
  assert.match(flashcards, /getAiLocaleContext\(context\.claims\)/);
  assert.match(flashcardsOverview, /getAiLocaleContext\(claims\)/);
  assert.doesNotMatch(questions, /auth\.getUser\(/);
  assert.doesNotMatch(flashcards, /auth\.getUser\(/);
  assert.doesNotMatch(flashcardsOverview, /auth\.getUser\(/);
  assert.match(middleware, /supabase\.auth\.getClaims\(token\)/);
});
