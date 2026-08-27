export const SERVER_OPERATION_TIMEOUT = "SERVER_OPERATION_TIMEOUT";

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_ATTEMPTS = 2;

/** Bounds slow external reads and retries only requests that exceeded the deadline. */
export async function runBoundedServerOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: { timeoutMs?: number; attempts?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        operation(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(SERVER_OPERATION_TIMEOUT));
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      const timedOut = error instanceof Error && error.message === SERVER_OPERATION_TIMEOUT;
      if (!timedOut || attempt === attempts) throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw new Error(SERVER_OPERATION_TIMEOUT);
}
