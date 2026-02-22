import { tokenStorage } from '../utils/tokenStorage';
import { ENV } from '../config/env';
import { SSEEvent } from '../types';

export interface SSECallbacks {
  onEvent: (event: SSEEvent) => void;
  onError: (error: Error) => void;
  onDone: () => void;
}

// ─────────────────────────────────────────────────────────────
// SSEClient — Server-Sent Events consumer for React Native.
//
// WHY XMLHttpRequest instead of EventSource or fetch+ReadableStream:
//
// 1. EventSource: The browser spec doesn't allow custom headers.
//    We MUST send `Authorization: Bearer <token>` — impossible with EventSource.
//
// 2. fetch + ReadableStream: React Native's fetch implementation has
//    inconsistent ReadableStream/body.getReader() support across
//    RN versions and platforms. It works in some environments but
//    not reliably enough for production.
//
// 3. XMLHttpRequest + onprogress: Works on EVERY React Native version.
//    We read `responseText.slice(processedLength)` on each `onprogress`
//    call to extract new chunks incrementally, mimicking true streaming.
//    This is the most battle-tested approach in the RN ecosystem.
// ─────────────────────────────────────────────────────────────

export class SSEClient {
  private xhr: XMLHttpRequest | null = null;
  private processedLength = 0;
  private buffer = '';
  private _isConnected = false;

  /**
   * Opens an SSE connection to the given endpoint.
   * The endpoint is called with a POST body (the user's chat message).
   * The server responds with `Content-Type: text/event-stream`.
   */
  async connect(
    endpoint: string,
    body: Record<string, unknown>,
    callbacks: SSECallbacks,
  ): Promise<void> {
    // Always clean up any existing connection before starting a new one
    this.disconnect();

    const tokens = await tokenStorage.load();
    if (!tokens?.accessToken) {
      callbacks.onError(new Error('Not authenticated — cannot open SSE stream'));
      return;
    }

    this._isConnected = true;
    this.processedLength = 0;
    this.buffer = '';

    const xhr = new XMLHttpRequest();
    this.xhr = xhr;

    // Guard against stalled connections (e.g., server stops sending keep-alives)
    const timeoutHandle = setTimeout(() => {
      this.disconnect();
      callbacks.onError(new Error('SSE connection timed out'));
    }, ENV.sseTimeoutMs);

    xhr.open('POST', `${ENV.apiBaseUrl}${endpoint}`, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Authorization', `Bearer ${tokens.accessToken}`);
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    // ── Core streaming logic ─────────────────────────────────
    // onprogress fires whenever new data arrives. We slice only
    // the NEW portion of responseText to avoid reprocessing.
    xhr.onprogress = () => {
      const newChunk = xhr.responseText.slice(this.processedLength);
      this.processedLength = xhr.responseText.length;

      this.buffer += newChunk;

      // SSE events are delimited by double newlines (\n\n)
      const events = this.buffer.split('\n\n');

      // The last element may be an incomplete event — keep it in the buffer
      this.buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        if (rawEvent.trim()) {
          this.parseAndDispatch(rawEvent, callbacks);
        }
      }
    };

    xhr.onload = () => {
      clearTimeout(timeoutHandle);
      // Flush any remaining buffered data
      if (this.buffer.trim()) {
        this.parseAndDispatch(this.buffer, callbacks);
        this.buffer = '';
      }
      this._isConnected = false;
      callbacks.onDone();
    };

    xhr.onerror = () => {
      clearTimeout(timeoutHandle);
      this._isConnected = false;
      callbacks.onError(
        new Error(
          xhr.status > 0
            ? `SSE request failed with status ${xhr.status}`
            : 'SSE network error — check connectivity',
        ),
      );
    };

    // Triggered by our disconnect() call — not an error condition
    xhr.onabort = () => {
      clearTimeout(timeoutHandle);
      this._isConnected = false;
    };

    xhr.send(JSON.stringify(body));
  }

  /**
   * Parses a single SSE event block into a typed SSEEvent and dispatches it.
   *
   * SSE wire format for a single event:
   *   event: chunk
   *   data: {"content": "Hello, "}
   *
   * Multiple fields can appear; we capture `event:` and `data:` lines.
   */
  private parseAndDispatch(rawEvent: string, callbacks: SSECallbacks): void {
    const lines = rawEvent.split('\n');
    let eventType = 'message';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice('event: '.length).trim();
      } else if (line.startsWith('data: ')) {
        dataStr = line.slice('data: '.length).trim();
      }
    }

    // Skip empty data or keep-alive pings (:ping, comment lines)
    if (!dataStr || dataStr.startsWith(':')) return;

    try {
      const payload = JSON.parse(dataStr);
      // Merge the discriminant `type` field with the payload data
      const event: SSEEvent = { type: eventType as SSEEvent['type'], ...payload };
      callbacks.onEvent(event);
    } catch {
      // Malformed JSON from the server — log and continue; don't crash the stream
      console.warn('[SSEClient] Could not parse SSE event data:', dataStr);
    }
  }

  /**
   * Aborts the in-flight XHR and resets state.
   * Safe to call even if no connection is active.
   */
  disconnect(): void {
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }
    this.buffer = '';
    this.processedLength = 0;
    this._isConnected = false;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton instance.
// One active SSE stream at a time — the chat store owns it.
// ─────────────────────────────────────────────────────────────
export const sseClient = new SSEClient();
