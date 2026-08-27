import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMarkdownFlashcards } from "../src/lib/flashcards.parser.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
for (const name of [".env.local", ".env"]) {
  const path = resolve(root, name);
  if (!process.env.NVIDIA_API_KEY && existsSync(path)) process.loadEnvFile(path);
}

const key = process.env.NVIDIA_API_KEY;
if (!key) throw new Error("NVIDIA_API_KEY is not configured.");
const model =
  process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
  "meta/llama-3.1-8b-instruct";
const material = `Sistemas operacionais coordenam a execução de programas e o uso de recursos do computador. Um processo é um programa em execução com estado, memória e recursos próprios. Uma thread é uma unidade de execução dentro de um processo e pode compartilhar memória e recursos. O escalonador escolhe qual processo ou thread pronto recebe tempo de CPU. FCFS atende processos por ordem de chegada. Round Robin distribui fatias de tempo entre processos prontos. A troca de contexto salva o estado da tarefa atual e restaura o estado da próxima. Sincronização coordena o acesso concorrente a recursos compartilhados e evita condições de corrida. Exclusão mútua permite apenas uma unidade de execução na seção crítica. Semáforos controlam o acesso por meio de contadores e operações atômicas. Paginação divide a memória virtual em páginas e a memória física em quadros. A tabela de páginas traduz endereços virtuais em endereços físicos. Uma falta de página ocorre quando a página necessária não está na memória principal. Memória virtual permite executar programas maiores que a memória física disponível. Deadlock ocorre quando processos aguardam indefinidamente por recursos retidos entre si.`;
const system = `You are NEXA, an academic study agent. Create recall flashcards based EXCLUSIVELY on the supplied material.
Rules:
- Never use outside knowledge or invent unsupported facts.
- Create exactly 12 independently understandable cards. Avoid duplicate prompts.
- Prioritize important definitions, concepts, relationships, and recall.
- Follow the output language requirement for all user-facing card text. Preserve source terminology when technically necessary.`;
const format = `Return exactly 12 cards using this format:
## Card 1
Front: concise recall prompt
Back: concise sufficient answer

Repeat for every card.
The labels "Front:" and "Back:" and the heading token "## Card" are fixed parser tokens and must remain literal English. Only their values use the requested output language.`;

async function run(locale) {
  const instruction = locale === "pt-BR" ? "Write all user-facing generated content in Brazilian Portuguese (pt-BR)." : "Write all user-facing generated content in English.";
  const started = performance.now();
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1800, messages: [{ role: "system", content: `${system}\n\n${instruction}` }, { role: "user", content: `Document title: Fundamentos de Sistemas Operacionais\n\nMATERIAL (the only allowed source):\n"""\n${material}\n"""\n\nCreate the flashcard deck.\n\n${instruction}\n\nREQUIRED OUTPUT FORMAT:\n${format}` }] }) });
  const bodyText = await response.text();
  const body = JSON.parse(bodyText);
  const output = body.choices?.[0]?.message?.content ?? "";
  try {
    const deck = parseMarkdownFlashcards(output);
    console.log(JSON.stringify({ locale, status: response.status, model: body.model ?? model, latencyMs: Math.round(performance.now() - started), cards: deck.cards.length, firstCard: deck.cards[0] }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ locale, status: response.status, model: body.model ?? model, latencyMs: Math.round(performance.now() - started), parserError: error instanceof Error ? error.message : String(error), rawOutput: output }, null, 2));
    process.exitCode = 1;
  }
}

await run(process.argv.includes("--locale=en") ? "en" : "pt-BR");
