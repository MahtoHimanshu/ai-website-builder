import { create } from 'zustand';
import { sseClient } from '../services/sseClient';
import { chatService } from '../services/chatService';
import { useProjectStore } from './projectStore';
import { useGitHubStore } from './githubStore';
import { ChatMessage, BuildStatus, SSEEvent } from '../types';
import { ENV } from '../config/env';
import { fetchSiteConfig, fetchCatalogue, pushSiteConfig, TEMPLATE_OWNER, TEMPLATE_REPO } from '../services/githubService';
import { editSiteConfig as geminiEditSiteConfig } from '../services/geminiService';
import { editSiteConfig as zaiEditSiteConfig } from '../services/zaiService';

interface ChatState {
  messages: ChatMessage[];
  /** ID of the assistant message currently being streamed */
  streamingMessageId: string | null;
  buildStatus: BuildStatus;
  /** Human-readable status shown in the status banner */
  statusMessage: string;
  isStreaming: boolean;
  error: string | null;

  loadHistory: (projectId: string) => Promise<void>;
  sendMessage: (projectId: string, content: string) => Promise<void>;
  cancelStream: () => void;
  clearError: () => void;
  /** Resets the chat state when navigating away from a project */
  reset: () => void;
}

// ─────────────────────────────────────────────────────────────
// Chat Store — orchestrates the full interaction cycle:
//
//  User types message
//       │
//       ▼
//  Optimistically add user message to list
//  Add empty assistant message (placeholder for Gemini response)
//       │
//       ▼
//  [Gemini path — when EXPO_PUBLIC_GEMINI_API_KEY is set]
//    fetchSiteConfig + fetchCatalogue (parallel)
//    editSiteConfig via Gemini REST
//    pushSiteConfig to GitHub
//    wait ~40 s for Vercel auto-deploy
//    refreshPreview
//
//  [Legacy SSE path — fallback when no geminiApiKey]
//    Open SSE stream → /projects/{id}/chat/stream
//       ├─ chunk event    → append text to assistant message
//       ├─ status event   → update build status banner
//       ├─ preview_ready  → tell projectStore to reload WebView
//       ├─ error event    → mark message as failed
//       └─ done event     → finalize streaming state
// ─────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [],
  streamingMessageId: null,
  buildStatus: 'idle',
  statusMessage: '',
  isStreaming: false,
  error: null,

  loadHistory: async (projectId) => {
    try {
      const messages = await chatService.getHistory(projectId);
      set({ messages });
    } catch {
      // Non-fatal: start with empty history if the endpoint fails
      set({ messages: [] });
    }
  },

  sendMessage: async (projectId, content) => {
    // Prevent overlapping sends — the UI disables the input while streaming,
    // but this is a defence-in-depth guard.
    if (get().isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    // Create a placeholder assistant message that will be filled by Gemini or SSE
    const assistantId = `assistant-${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      streamingMessageId: assistantId,
      isStreaming: true,
      buildStatus: 'idle',
      statusMessage: '',
      error: null,
    }));

    // Use whichever AI key is set in .env; fall back to SSE if neither is configured
    const hasAiKey = ENV.zaiApiKey || ENV.geminiApiKey;
    if (hasAiKey) {
      await handleGeminiTurn(projectId, content, assistantId);
    } else {
      // Legacy SSE path (for when real backend exists)
      await sseClient.connect(
        `/projects/${projectId}/chat/stream`,
        { message: content },
        {
          onEvent: (event) => handleSSEEvent(event, assistantId),

          onError: (err) => {
            set((state) => ({
              isStreaming: false,
              streamingMessageId: null,
              error: err.message,
              buildStatus: 'error',
              statusMessage: err.message,
              messages: state.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, isStreaming: false, content: m.content || '_Generation failed._' }
                  : m,
              ),
            }));
          },

          onDone: () => {
            set((state) => ({
              isStreaming: false,
              streamingMessageId: null,
              messages: state.messages.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m,
              ),
            }));
          },
        },
      );
    }
  },

  cancelStream: () => {
    const { streamingMessageId } = get();
    sseClient.disconnect();
    set((state) => ({
      isStreaming: false,
      streamingMessageId: null,
      messages: state.messages.map((m) =>
        m.id === streamingMessageId ? { ...m, isStreaming: false } : m,
      ),
    }));
  },

  clearError: () => set({ error: null }),

  reset: () => {
    sseClient.disconnect();
    set({
      messages: [],
      streamingMessageId: null,
      buildStatus: 'idle',
      statusMessage: '',
      isStreaming: false,
      error: null,
    });
  },
}));

// ─────────────────────────────────────────────────────────────
// Gemini turn handler — full GitHub + Gemini + deploy cycle.
// Runs outside the store creator so it can access the store
// via useChatStore.getState() without stale closures.
// ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleGeminiTurn(
  projectId: string,
  userInstruction: string,
  assistantId: string,
): Promise<void> {
  const pat            = useGitHubStore.getState().pat;
  const currentProject = useProjectStore.getState().currentProject;

  // Auto-detect which service to use based on whichever key is set in .env
  const zaiKey    = ENV.zaiApiKey;
  const geminiKey = ENV.geminiApiKey;
  const provider  = zaiKey ? 'zai' : 'gemini';
  const apiKey    = zaiKey || geminiKey;

  const [owner, repo] = (currentProject?.githubRepo ?? `${TEMPLATE_OWNER}/${TEMPLATE_REPO}`).split('/');

  try {
    // ── Phase 1: fetch context + generate ───────────────────────────
    useChatStore.setState({
      buildStatus: 'generating_ui',
      statusMessage: 'Thinking…',
    });

    let source = '';
    let sha    = '';
    let catalogue = '';

    if (pat) {
      [{ source, sha }, catalogue] = await Promise.all([
        fetchSiteConfig(pat, owner, repo),
        fetchCatalogue(pat, owner, repo),
      ]);
    }
    // If no PAT — proceed with empty strings so Gemini still responds

    const { messages } = useChatStore.getState();
    const editFn = provider === 'zai' ? zaiEditSiteConfig : geminiEditSiteConfig;
    const { configSource, explanation } = await editFn(
      apiKey,
      source,
      catalogue,
      messages,
      userInstruction,
    );

    // ── Phase 2: push to GitHub ──────────────────────────────────────
    if (pat) {
      useChatStore.setState({
        buildStatus: 'deploying_backend',
        statusMessage: 'Pushing to GitHub…',
      });
      try {
        await pushSiteConfig(pat, owner, repo, configSource, sha, userInstruction);
      } catch (pushErr) {
        // 409 conflict — a previous push already updated the file so our SHA
        // is stale. Re-fetch the latest SHA and retry once with the same content.
        if (pushErr instanceof Error && pushErr.message.includes('Conflict')) {
          const { sha: freshSha } = await fetchSiteConfig(pat, owner, repo);
          await pushSiteConfig(pat, owner, repo, configSource, freshSha, userInstruction);
        } else {
          throw pushErr;
        }
      }
    }

    // ── Phase 3: surface explanation in chat ────────────────────────
    useChatStore.setState((state) => ({
      messages: state.messages.map((m) =>
        m.id === assistantId
          ? { ...m, content: explanation, isStreaming: false }
          : m,
      ),
      streamingMessageId: null,
      isStreaming: false,
    }));

    if (pat) {
      // ── Phase 4: wait for Vercel auto-deploy (~40 s) ───────────────
      useChatStore.setState({
        buildStatus: 'deploying_backend',
        statusMessage: 'Deploying to Vercel… (~40 s)',
      });
      await delay(40_000);

      // ── Phase 5: refresh preview ───────────────────────────────────
      useProjectStore.getState().refreshPreview();
      useChatStore.setState({
        buildStatus: 'ready',
        statusMessage: 'Preview ready ✓',
      });
    } else {
      useChatStore.setState({ buildStatus: 'ready', statusMessage: '' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    useChatStore.setState((state) => ({
      messages: state.messages.map((m) =>
        m.id === assistantId
          ? { ...m, content: `_Error: ${message}_`, isStreaming: false }
          : m,
      ),
      streamingMessageId: null,
      isStreaming: false,
      buildStatus: 'error',
      statusMessage: message,
      error: message,
    }));
  }
}

// ─────────────────────────────────────────────────────────────
// SSE event dispatcher — extracted outside the store creator to
// keep the closure tidy and allow direct store access.
// ─────────────────────────────────────────────────────────────

function handleSSEEvent(event: SSEEvent, streamingMessageId: string): void {
  switch (event.type) {
    case 'chunk':
      // Append incoming text to the streaming assistant message
      useChatStore.setState((state) => ({
        messages: state.messages.map((m) =>
          m.id === streamingMessageId ? { ...m, content: m.content + event.content } : m,
        ),
      }));
      break;

    case 'status':
      useChatStore.setState({
        buildStatus: event.status,
        statusMessage: event.message,
      });
      break;

    case 'preview_ready':
      // Delegate WebView reload to the project store — single responsibility
      useProjectStore.getState().updatePreviewUrl(event.previewUrl);
      useChatStore.setState({ buildStatus: 'ready', statusMessage: 'Preview ready' });
      break;

    case 'error':
      useChatStore.setState({
        error: event.message,
        buildStatus: 'error',
        statusMessage: event.message,
      });
      break;

    case 'done':
      useChatStore.setState((state) => ({
        isStreaming: false,
        streamingMessageId: null,
        messages: state.messages.map((m) =>
          m.id === streamingMessageId ? { ...m, isStreaming: false } : m,
        ),
      }));
      break;
  }
}
