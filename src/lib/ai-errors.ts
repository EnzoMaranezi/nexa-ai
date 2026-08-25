export const AI_DAILY_LIMIT_REACHED = "AI_DAILY_LIMIT_REACHED";
export const AI_PROVIDERS_UNAVAILABLE = "AI_PROVIDERS_UNAVAILABLE";
export const AI_GENERATION_IN_PROGRESS = "AI_GENERATION_IN_PROGRESS";

export function aiErrorMessage(error: unknown, t: (key: string) => string, fallback: string) {
  if (error instanceof Error && error.message.includes(AI_DAILY_LIMIT_REACHED)) {
    return t("ai.limitReached");
  }
  if (error instanceof Error && error.message.includes(AI_PROVIDERS_UNAVAILABLE)) {
    return t("ai.providersUnavailable");
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
