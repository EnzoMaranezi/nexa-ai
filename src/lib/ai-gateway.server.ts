import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  AI_PROVIDERS_UNAVAILABLE,
  runAiProviderChain,
  type AiProviderAttempt,
} from "@/lib/ai-provider-chain";
import { buildAiGenerationMessages } from "@/lib/ai-generation-messages";
import { getUserLocale, languageInstruction, type Locale } from "@/lib/i18n";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_PRIMARY_MODEL = "openai/gpt-oss-20b";
const NVIDIA_FALLBACK_MODEL = "openai/gpt-oss-120b";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

type AiGenerationRequest = {
  system: string;
  prompt: string;
  outputFormat?: string;
  languageInstruction: string;
};

type AiTextGeneration = {
  text: string;
  provider: AiProviderAttempt["provider"];
  model: string;
};

function providerForAttempt(attempt: AiProviderAttempt) {
  const apiKey =
    attempt.provider === "nvidia"
      ? process.env["NVIDIA_API_KEY"]
      : process.env["OPENROUTER_API_KEY"];
  if (!apiKey) return null;

  return createOpenAICompatible({
    name: attempt.provider,
    baseURL: attempt.provider === "nvidia" ? NVIDIA_BASE_URL : OPENROUTER_BASE_URL,
    headers: { Authorization: `Bearer ${apiKey}` },
    supportsStructuredOutputs: false,
  });
}

function availableProviderAttempts(): AiProviderAttempt[] {
  const attempts: AiProviderAttempt[] = [];

  if (process.env["NVIDIA_API_KEY"]) {
    attempts.push(
      { provider: "nvidia", model: NVIDIA_PRIMARY_MODEL, label: "nvidia-primary" },
      { provider: "nvidia", model: NVIDIA_FALLBACK_MODEL, label: "nvidia-fallback" },
    );
  }

  const openRouterModel = process.env["OPENROUTER_MODEL"];
  if (process.env["OPENROUTER_API_KEY"] && openRouterModel) {
    attempts.push({ provider: "openrouter", model: openRouterModel, label: "openrouter-fallback" });
  }

  return attempts;
}

function logProviderAttempt(event: {
  attempt: number;
  provider: string;
  model: string;
  latencyMs: number;
  outcome: string;
  category: string;
}) {
  console.info(
    "[ai-gateway]",
    JSON.stringify({
      provider: event.provider,
      model: event.model,
      attempt: event.attempt,
      latencyMs: event.latencyMs,
      outcome: event.outcome,
      category: event.category,
    }),
  );
}

export async function generateAiText({
  system,
  prompt,
  outputFormat,
  languageInstruction: outputLanguageInstruction,
}: AiGenerationRequest): Promise<AiTextGeneration> {
  const attempts = availableProviderAttempts();
  if (attempts.length === 0) throw new Error(AI_PROVIDERS_UNAVAILABLE);
  const messages = buildAiGenerationMessages({
    system,
    prompt,
    outputFormat,
    languageInstruction: outputLanguageInstruction,
  });

  try {
    return await runAiProviderChain({
      attempts,
      generate: async (attempt) => {
        const provider = providerForAttempt(attempt);
        if (!provider) throw new Error("Provider is not configured.");

        const result = await generateText({
          model: provider(attempt.model),
          system: messages.system,
          prompt: messages.prompt,
        });
        return { text: result.text, provider: attempt.provider, model: attempt.model };
      },
      onAttempt: logProviderAttempt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === AI_PROVIDERS_UNAVAILABLE) throw error;
    throw new Error("AI_PROVIDER_REQUEST_FAILED");
  }
}

export function normalizeAiError(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : "";
  if (message === AI_PROVIDERS_UNAVAILABLE) return new Error(AI_PROVIDERS_UNAVAILABLE);
  if (message === "AI_PROVIDER_REQUEST_FAILED") return new Error(fallback);
  if (/402/.test(message)) {
    return new Error("AI credits are exhausted for this workspace. Add credits and try again.");
  }
  if (/429/.test(message)) {
    return new Error("The AI service is rate limited right now. Please try again in a moment.");
  }
  return new Error(message || fallback);
}

/** Locale comes from claims already verified by requireSupabaseAuth. */
export function getAiLocaleContext(claims: { user_metadata?: unknown }): {
  locale: Locale;
  languageInstruction: string;
} {
  const locale = getUserLocale(claims.user_metadata as Record<string, unknown> | undefined);
  return { locale, languageInstruction: languageInstruction(locale) };
}
