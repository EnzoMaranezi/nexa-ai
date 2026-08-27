export const AUTH_VERIFICATION_TIMEOUT_MS = 8_000;
export const AUTH_VERIFICATION_ATTEMPTS = 2;
export const AUTH_VERIFICATION_UNAVAILABLE = "AUTH_VERIFICATION_UNAVAILABLE";

class AuthVerificationFailure extends Error {
  readonly retryable: boolean;

  constructor(
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.retryable = retryable;
  }
}

function isTransientVerificationFailure(error: unknown) {
  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true;
  }
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  return /abort|timeout|network|fetch|retryable/i.test(`${name} ${message}`);
}

/**
 * Keeps cryptographic verification bounded. Callers must provide an operation
 * that returns verified claims, never decoded token payloads.
 */
export async function runBoundedAuthVerification<T>(
  verify: () => Promise<T>,
  options: { timeoutMs?: number; attempts?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? AUTH_VERIFICATION_TIMEOUT_MS;
  const attempts = options.attempts ?? AUTH_VERIFICATION_ATTEMPTS;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        verify(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new AuthVerificationFailure("Auth verification timed out.", true)),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      const retryable =
        error instanceof AuthVerificationFailure
          ? error.retryable
          : isTransientVerificationFailure(error);
      if (!retryable) throw error;
      if (attempt === attempts) throw new Error(AUTH_VERIFICATION_UNAVAILABLE);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw new Error(AUTH_VERIFICATION_UNAVAILABLE);
}

/** Adds an abort deadline to JWKS/Auth HTTP requests so timed-out work is cancelled. */
export function createBoundedAuthFetch(
  baseFetch: typeof fetch,
  timeoutMs = AUTH_VERIFICATION_TIMEOUT_MS,
): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abortFromRequest = () => controller.abort(requestSignal?.reason);
    requestSignal?.addEventListener("abort", abortFromRequest, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", abortFromRequest);
    });
  };
}
