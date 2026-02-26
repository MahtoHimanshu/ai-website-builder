// ─────────────────────────────────────────────────────────────
// Core domain types for the AI Website Builder mobile client.
// The app is a thin client — these types model the CONTRACT
// with the backend, not any website logic.
// ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp in milliseconds when the accessToken expires */
  expiresAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  /** Stable preview URL — server overwrites this file on each update */
  previewUrl: string;
  /**
   * Per-project GitHub repo in "owner/repo" format.
   * Set when the project is backed by a forked template repo.
   * Absent for mock/offline projects.
   */
  githubRepo?: string;
  status: 'idle' | 'generating' | 'deploying' | 'ready' | 'error';
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** True while an SSE stream is actively appending to this message */
  isStreaming?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Build status: reflects the server-side pipeline state.
// These values are sent by the backend via SSE `status` events.
// ─────────────────────────────────────────────────────────────
export type BuildStatus =
  | 'idle'
  | 'generating_ui'
  | 'deploying_backend'
  | 'uploading_preview'
  | 'ready'
  | 'error';

// ─────────────────────────────────────────────────────────────
// SSE event types streamed from the backend during generation.
// Each event type maps to a discrete UI action in the client.
// ─────────────────────────────────────────────────────────────
export type SSEEventType = 'chunk' | 'status' | 'preview_ready' | 'error' | 'done';

export interface SSEChunkEvent {
  type: 'chunk';
  /** Partial AI response text to append to the current assistant message */
  content: string;
}

export interface SSEStatusEvent {
  type: 'status';
  status: BuildStatus;
  message: string;
}

export interface SSEPreviewReadyEvent {
  type: 'preview_ready';
  /** Full URL to the updated preview — app reloads WebView to this URL */
  previewUrl: string;
  version: number;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

export interface SSEDoneEvent {
  type: 'done';
  messageId: string;
}

export type SSEEvent =
  | SSEChunkEvent
  | SSEStatusEvent
  | SSEPreviewReadyEvent
  | SSEErrorEvent
  | SSEDoneEvent;

// ─────────────────────────────────────────────────────────────
// Generic API response wrapper matching the backend envelope.
// ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}
