import { parseMarkdownFlashcards } from "../src/lib/flashcards.parser.ts";

const key = process.env.NVIDIA_API_KEY;
if (!key) throw new Error("NVIDIA_API_KEY is not configured.");
const model = "meta/llama-3.1-8b-instruct";
const material = `Operating systems coordinate program execution and computer resources. A process is a running program with its own state, memory, and resources. A thread is an execution unit within a process and can share its memory and resources. The scheduler chooses which ready process or thread receives CPU time. Synchronization coordinates concurrent access to shared resources and avoids race conditions. Mutual exclusion lets only one execution unit enter a critical section at a time.`;
const system = `You are NEXA. Create exactly 12 concise academic flashcards based only on the supplied material. Do not invent information. The labels "Front:" and "Back:" and heading token "## Card" must remain literal English parser tokens.`;

async function run(locale) {
  const instruction = locale === "pt-BR" ? "Write all user-facing generated content in Brazilian Portuguese (pt-BR)." : "Write all user-facing generated content in English.";
  const started = performance.now();
  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, temperature: 0.2, max_tokens: 1800, messages: [{ role: "system", content: `${system}\n${instruction}` }, { role: "user", content: `MATERIAL:\n${material}\n\n${instruction}\nReturn the deck now.` }] }) });
  const body = await response.json();
  const output = body.choices?.[0]?.message?.content ?? "";
  const deck = parseMarkdownFlashcards(output);
  console.log(JSON.stringify({ locale, status: response.status, model: body.model ?? model, latencyMs: Math.round(performance.now() - started), cards: deck.cards.length, firstCard: deck.cards[0] }, null, 2));
}

await run("pt-BR");
await run("en");
