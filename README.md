# AI Website Builder

A production-ready React Native (Expo) thin client for an enterprise AI website builder.

## Architecture

```
app/                         # Expo Router file-based screens
├── index.tsx                # Auth gate (redirect only)
├── _layout.tsx              # Root: session restore + providers
├── (auth)/
│   ├── login.tsx
│   └── register.tsx
└── (app)/
    ├── index.tsx            # Project list
    ├── workspace/[projectId].tsx   # ★ Main screen: preview + chat
    └── preview/[projectId].tsx     # Fullscreen preview

src/
├── config/env.ts            # All URLs injected from Expo config
├── types/index.ts           # Domain types (contracts with backend)
├── utils/
│   ├── tokenStorage.ts      # expo-secure-store wrapper
│   └── previewUrl.ts        # Stable URL + cache-busting helpers
├── services/
│   ├── api.ts               # Axios + token refresh queue
│   ├── authService.ts
│   ├── projectService.ts
│   ├── chatService.ts
│   └── sseClient.ts         # XHR-based SSE stream consumer
├── stores/
│   ├── authStore.ts         # Zustand: auth state + session restore
│   ├── projectStore.ts      # Zustand: projects + WebView reload
│   └── chatStore.ts         # Zustand: messages + SSE orchestration
└── components/
    ├── common/              # ErrorBoundary, LoadingSpinner
    ├── auth/                # (inline in screens)
    ├── preview/             # PreviewWebView
    ├── chat/                # ChatList, ChatBubble, ChatInput, StatusBanner
    └── projects/            # ProjectCard, CreateProjectModal
```

## Key Design Decisions

### 1. XHR-based SSE (not EventSource)
React Native's `EventSource` doesn't support custom headers — we need
`Authorization: Bearer <token>`. XMLHttpRequest with `onprogress` reads
incremental `responseText` chunks, reliably across all RN versions.

### 2. `key={previewVersion}` for WebView reload
Changing the `key` prop unmounts and remounts the WebView component entirely.
This is more reliable than `webViewRef.current.reload()` or `source` changes,
because it bypasses the native WebView's internal cache state.

### 3. Token refresh queue
The Axios interceptor uses a queue pattern: when a refresh is in flight,
subsequent 401 errors queue their resolve/reject callbacks. This prevents
multiple simultaneous refresh requests (backends typically reject these).

### 4. Stable preview URL
The server always writes to `/projects/{id}/index.html`.
We append `?t=<timestamp>` for cache-busting — the path never changes.
This means no routing complexity and no broken bookmarks.

### 5. Chat store owns SSE lifecycle
The chat store starts/stops the SSE client and dispatches events to
both itself and the project store. Clean separation: the project store
only knows about URLs, never about chat or streams.

## Setup

```bash
cp .env.example .env.local
# Fill in EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_PREVIEW_BASE_URL

npx expo install
npx expo start
```

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend REST API (e.g. `https://api.yourplatform.com/v1`) |
| `EXPO_PUBLIC_PREVIEW_BASE_URL` | Preview server (e.g. `https://preview.yourplatform.com`) |

These are build-time values baked into the JS bundle. Do NOT put secrets here.

## Backend SSE Contract

The app expects POST `/projects/{id}/chat/stream` to return `text/event-stream`:

```
event: status
data: {"status":"generating_ui","message":"Generating UI components..."}

event: chunk
data: {"content":"Here's what I built for you: "}

event: chunk
data: {"content":"a clean landing page with..."}

event: preview_ready
data: {"previewUrl":"https://preview.yourplatform.com/projects/abc/index.html","version":3}

event: done
data: {"messageId":"msg_xyz"}
```

## Security Notes

- JWT and refresh tokens are stored in `expo-secure-store` (iOS Keychain / Android Keystore)
- WebView is `incognito` — no cross-project session leakage
- `originWhitelist` restricts WebView navigation to the preview domain only
- `allowFileAccess={false}` — no local file access from WebView
- No HTML/CSS/JS is ever generated or stored on the device
