export type AiGenerationMessagesInput = {
  system: string;
  prompt: string;
  outputFormat?: string | undefined;
  languageInstruction: string;
};

export function buildAiGenerationMessages({
  system,
  prompt,
  outputFormat,
  languageInstruction,
}: AiGenerationMessagesInput) {
  const languageContract = `OUTPUT LANGUAGE REQUIREMENT:
${languageInstruction}
This applies to every user-facing generated field. Do not switch generated content to the source material's language when it differs from this requirement. Preserve only format labels and headings explicitly marked as fixed parser tokens.`;

  return {
    system: `${system}\n\n${languageContract}`,
    prompt: [prompt, languageContract, outputFormat].filter(Boolean).join("\n\n"),
  };
}
