import { create } from 'zustand';
import { sseClient } from '../services/sseClient';
import { chatService } from '../services/chatService';
import { useProjectStore } from './projectStore';
import { ChatMessage, BuildStatus, SSEEvent } from '../types';

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
//  Add empty assistant message (placeholder for stream)
//       │
//       ▼
//  Open SSE stream → /projects/{id}/chat/stream
//       │
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

    // Create a placeholder assistant message that will be filled by the stream
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
