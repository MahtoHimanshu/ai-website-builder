/**
 * geminiService — Gemini REST API wrapper for site.config.ts editing.
 *
 * Sends the current config + catalogue + chat history to Gemini and
 * parses back a fully updated TypeScript config file plus a plain-text
 * explanation for the user.
 */

import { ChatMessage } from '../types';

const GEMINI_API =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/** Maximum number of recent messages to include (token budget). */
const MAX_HISTORY = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  system_instruction: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls Gemini to edit site.config.ts based on the user's instruction.
 *
 * Returns:
 *   configSource  — the complete updated TypeScript file content
 *   explanation   — a short human-readable summary of what changed
 */
export async function editSiteConfig(
  apiKey: string,
  currentConfig: string,
  catalogue: string,
  chatHistory: ChatMessage[],
  userInstruction: string,
): Promise<{ configSource: string; explanation: string }> {
  const systemPrompt = buildSystemPrompt(currentConfig, catalogue);
  const contents = buildContents(chatHistory, userInstruction);

  const body: GeminiRequest = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
  };

  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };

  // Retry up to 3 times on 429 with exponential backoff: 2 s → 4 s → 8 s
  const res = await fetchWithRetry(`${GEMINI_API}?key=${apiKey}`, init);

  if (res.status === 400) throw new Error('Gemini: Bad request — check your API key or payload.');
  if (res.status === 401 || res.status === 403) throw new Error('Gemini: Invalid or unauthorised API key.');
  if (res.status === 429) throw new Error('Gemini: Rate limit still exceeded after retries — wait a minute and try again.');
  if (!res.ok) throw new Error(`Gemini: Unexpected error HTTP ${res.status}.`);

  const data = await res.json() as GeminiResponse;
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  return parseGeminiResponse(rawText);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retries a fetch on HTTP 429 with exponential backoff.
 * Delays: 2 s, 4 s, 8 s before each retry.
 */
async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let res = await fetch(url, init);
  let attempt = 0;
  while (res.status === 429 && attempt < maxRetries) {
    const waitMs = Math.pow(2, attempt + 1) * 1000; // 2 s, 4 s, 8 s
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    attempt++;
    res = await fetch(url, init);
  }
  return res;
}

function buildSystemPrompt(currentConfig: string, catalogue: string): string {
  const catalogueSection = catalogue
    ? `Available section types from catalogue.ts:\n\`\`\`typescript\n${catalogue}\n\`\`\``
    : 'No catalogue provided — only modify existing sections.';

  return `You are an AI website editor for WebForge.
Edit the site.config.ts file based on the user's instruction.

${catalogueSection}

RULES:
1. Return the COMPLETE updated site.config.ts inside a \`\`\`typescript block.
2. After the closing \`\`\` write a brief 1–2 sentence summary of what changed.
3. Only use section types listed in the catalogue.
4. Preserve any sections the user didn't ask to change.
5. Valid TypeScript only — no comments outside the file, no extra text before the code block.
6. If the request requires interactive/dynamic functionality (e.g. a working counter, calculator, game, live data, user input with logic) that CANNOT be built with the available static section types: still return a COMPLETE updated config, adapt the request to a themed landing page for that idea with vivid and specific content (not generic placeholders), and in your post-code explanation clearly state: "Note: A working [X] requires dynamic JavaScript which WebForge's static sections don't support yet. I've built a [Y] landing page instead."
7. Make the content vivid and specific to the theme — avoid generic filler text like "Lorem ipsum" or "Our amazing product".

Current site.config.ts:
\`\`\`typescript
${currentConfig}
\`\`\``;
}

function buildContents(
  chatHistory: ChatMessage[],
  userInstruction: string,
): GeminiContent[] {
  // Filter to user/assistant only; skip system messages and the current
  // empty streaming placeholder (content === '' with isStreaming === true).
  // Then drop the LAST item — it is the current user message that was just
  // optimistically added to the store. We append it explicitly below to
  // avoid two consecutive `user` turns (which the Gemini API rejects).
  const eligible = chatHistory
    .filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') &&
        !(m.isStreaming && m.content === ''),
    )
    .slice(0, -1)      // drop current user turn (already in store)
    .slice(-MAX_HISTORY);

  const history: GeminiContent[] = eligible.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  // Append the current instruction as the final user turn
  history.push({ role: 'user', parts: [{ text: userInstruction }] });

  return history;
}

function parseGeminiResponse(raw: string): {
  configSource: string;
  explanation: string;
} {
  // Match the first ```typescript ... ``` block
  const codeMatch = raw.match(/```typescript\s*([\s\S]*?)```/);
  if (!codeMatch) {
    throw new Error('Gemini returned an unparseable response.');
  }

  const configSource = codeMatch[1].trim();

  // Everything after the closing ``` is the explanation
  const afterBlock = raw.slice(raw.indexOf('```', raw.indexOf('```typescript') + 12) + 3).trim();
  const explanation = afterBlock || 'Site configuration updated.';

  return { configSource, explanation };
}
