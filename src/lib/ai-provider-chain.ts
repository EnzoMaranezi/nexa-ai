export const AI_PROVIDERS_UNAVAILABLE = "AI_PROVIDERS_UNAVAILABLE";

export type AiProviderAttempt = {
  provider: "nvidia" | "openrouter";
  model: string;
  label: string;
};

export type AiProviderAttemptLog = {
  attempt: number;
  provider: AiProviderAttempt["provider"];
  model: string;
  latencyMs: number;
  outcome: "success" | "failure";
  category: "success" | "transient" | "non_retryable" | "not_configured";
};

export function isEligibleProviderFallback(error: unknown) {
  const details = typeof error === "object" && error !== null ? error : undefined;
  const statusCode =
    details && "statusCode" in details && typeof details.statusCode === "number"
      ? details.statusCode
      : details && "status" in details && typeof details.status === "number"
        ? details.status
        : undefined;

  if (
    statusCode !== undefined &&
    (statusCode === 404 ||
      statusCode === 410 ||
      statusCode === 408 ||
      statusCode === 409 ||
      statusCode === 425 ||
      statusCode === 429 ||
      statusCode >= 500)
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  return /(?:model|provider).*(?:unavailable|not available|not found|no longer available|end of life|deprecated|gone)|no available provider|capacity|overload|temporar(?:y|ily)|timeout|timed out|abort(?:ed)?|connection|connect|socket|econnreset|econnrefused|fetch failed|free model/i.test(
    message,
  );
}

export async function runAiProviderChain<T>({
  attempts,
  generate,
  onAttempt,
}: {
  attempts: AiProviderAttempt[];
  generate: (attempt: AiProviderAttempt) => Promise<T>;
  onAttempt?: (event: AiProviderAttemptLog) => void;
}): Promise<T> {
  for (const [index, attempt] of attempts.entries()) {
    const startedAt = Date.now();
    try {
      const result = await generate(attempt);
      onAttempt?.({
        attempt: index + 1,
        provider: attempt.provider,
        model: attempt.model,
        latencyMs: Date.now() - startedAt,
        outcome: "success",
        category: "success",
      });
      return result;
    } catch (error) {
      const eligibleForFallback = isEligibleProviderFallback(error);
      onAttempt?.({
        attempt: index + 1,
        provider: attempt.provider,
        model: attempt.model,
        latencyMs: Date.now() - startedAt,
        outcome: "failure",
        category: eligibleForFallback ? "transient" : "non_retryable",
      });
      if (!eligibleForFallback) throw error;
    }
  }

  throw new Error(AI_PROVIDERS_UNAVAILABLE);
}
