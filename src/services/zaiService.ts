/**
 * zaiService — Z.AI (GLM-4) REST wrapper for site.config.ts editing.
 *
 * Z.AI uses the OpenAI-compatible chat completions format, so the system
 * prompt goes in as a `system` role message — much simpler than Gemini.
 *
 * Endpoint: POST https://api.z.ai/api/paas/v4/chat/completions
 */

import { ChatMessage } from '../types';

const ZAI_API    = 'https://api.z.ai/api/paas/v4/chat/completions';
const ZAI_MODEL  = 'glm-4-32b-0414-128k';

/** Maximum prior turns to include (token budget). */
const MAX_HISTORY = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ZAIRequest {
  model: string;
  messages: ZAIMessage[];
}

interface ZAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Calls Z.AI to edit site.config.ts based on the user's instruction.
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
  const messages = buildMessages(currentConfig, catalogue, chatHistory, userInstruction);

  const body: ZAIRequest = { model: ZAI_MODEL, messages };

  const res = await fetch(ZAI_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) throw new Error('Z.AI: Invalid or unauthorised API key.');
  if (res.status === 429) throw new Error('Z.AI: Rate limit exceeded — please wait and retry.');
  if (res.status === 400) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Z.AI: Bad request — ${body.message ?? 'check your payload'}.`);
  }
  if (!res.ok) throw new Error(`Z.AI: Unexpected error HTTP ${res.status}.`);

  const data = await res.json() as ZAIResponse;
  const rawText = data.choices?.[0]?.message?.content ?? '';

  if (!rawText) throw new Error('Z.AI returned an empty response.');

  return parseResponse(rawText);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMessages(
  currentConfig: string,
  catalogue: string,
  chatHistory: ChatMessage[],
  userInstruction: string,
): ZAIMessage[] {
  const catalogueSection = catalogue
    ? `Available section types from catalogue.ts:\n\`\`\`typescript\n${catalogue}\n\`\`\``
    : 'No catalogue provided — only modify existing sections.';

  const systemPrompt = `You are an AI website editor for WebForge.
Edit the site.config.ts file based on the user's instruction.

${catalogueSection}

RULES:
1. Your response MUST start with a \`\`\`typescript code block containing the COMPLETE updated file.
2. Do NOT add any text or explanation before the opening \`\`\`typescript fence.
3. After the closing \`\`\` write a brief 1–2 sentence summary of what changed.
4. Only use section types listed in the catalogue.
5. Preserve any sections the user didn't ask to change.
6. Valid TypeScript only — no extra commentary inside the code block.
7. If the request requires interactive/dynamic functionality (e.g. a working counter, calculator, game, live data, user input with logic) that CANNOT be built with the available static section types: still return a COMPLETE updated config, adapt the request to a themed landing page for that idea with vivid and specific content (not generic placeholders), and in your post-code explanation clearly state: "Note: A working [X] requires dynamic JavaScript which WebForge's static sections don't support yet. I've built a [Y] landing page instead."
8. Make the content vivid and specific to the theme — avoid generic filler text like "Lorem ipsum" or "Our amazing product".

Current site.config.ts:
\`\`\`typescript
${currentConfig}
\`\`\``;

  const messages: ZAIMessage[] = [{ role: 'system', content: systemPrompt }];

  // Prior conversation turns — drop the last item (current user message,
  // already in the store) to avoid duplicating it at the end.
  const prior = chatHistory
    .filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') &&
        !(m.isStreaming && m.content === ''),
    )
    .slice(0, -1)
    .slice(-MAX_HISTORY);

  for (const m of prior) {
    messages.push({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    });
  }

  // Current user instruction as the final turn
  messages.push({ role: 'user', content: userInstruction });

  return messages;
}

function parseResponse(raw: string): { configSource: string; explanation: string } {
  // GLM-4 may use ```typescript, ```ts, or a plain ``` block — try each in order.
  const codeMatch =
    raw.match(/```typescript\s*([\s\S]*?)```/) ||
    raw.match(/```ts\s*([\s\S]*?)```/)         ||
    raw.match(/```\s*([\s\S]*?)```/);

  if (!codeMatch) {
    const preview = raw.slice(0, 200).replace(/\n/g, '↵');
    throw new Error(`Z.AI returned an unparseable response — no code block found. Preview: "${preview}"`);
  }

  const configSource = codeMatch[1].trim();

  // Find where the matched code block ends and take everything after as explanation
  const blockEnd = raw.indexOf(codeMatch[0]) + codeMatch[0].length;
  const explanation = raw.slice(blockEnd).trim() || 'Site configuration updated.';

  return { configSource, explanation };
}
