import { runReservedAiGeneration } from "./ai-generation-action.ts";

export async function pollForCachedValue<T>({
  loadCached,
  wait,
  intervalMs,
  maxAttempts,
}: {
  loadCached: () => Promise<T | null>;
  wait: (milliseconds: number) => Promise<void>;
  intervalMs: number;
  maxAttempts: number;
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await wait(intervalMs);
    const cached = await loadCached();
    if (cached) return cached;
  }
  return null;
}

export async function runCachedTopicDiscovery<TCached, TGenerated, TReservation>({
  loadCached,
  reserve,
  generate,
  persist,
  finish,
  isGenerationInProgress,
  waitForCached,
}: {
  loadCached: () => Promise<TCached | null>;
  reserve: () => Promise<TReservation>;
  generate: () => Promise<TGenerated>;
  persist: (generated: TGenerated) => Promise<TCached>;
  finish: (reservation: TReservation, status: "succeeded" | "failed") => Promise<void>;
  isGenerationInProgress: (error: unknown) => boolean;
  waitForCached: () => Promise<TCached | null>;
}) {
  const cached = await loadCached();
  if (cached) return { reused: true as const, value: cached };

  try {
    const value = await runReservedAiGeneration({
      reserve,
      generate,
      afterGenerate: persist,
      finish,
    });
    return { reused: false as const, value };
  } catch (error) {
    if (!isGenerationInProgress(error)) throw error;
    const completed = await waitForCached();
    if (completed) return { reused: true as const, value: completed };
    throw error;
  }
}
