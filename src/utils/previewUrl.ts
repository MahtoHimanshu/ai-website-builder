import { ENV } from '../config/env';

// ─────────────────────────────────────────────────────────────
// Preview URL helpers.
//
// DESIGN PRINCIPLE: The preview URL path is STABLE.
// The server always writes the latest build to the same file:
//   /projects/{projectId}/index.html
//
// Cache-busting is done via `?t=<timestamp>` — NOT by changing
// the path. This means:
// - The WebView always reloads the freshest server output
// - No need to track versioned URLs on the client
// - The backend never needs to know the client's version number
// ─────────────────────────────────────────────────────────────

/**
 * Builds the initial preview URL for a project.
 * The `version` param is a Unix timestamp used as a cache-buster.
 */
export function buildPreviewUrl(projectId: string, version?: number): string {
  const base = `${ENV.previewBaseUrl}/projects/${projectId}/index.html`;
  const ts = version ?? Date.now();
  return `${base}?t=${ts}`;
}

/**
 * Bumps the `?t=` cache-busting timestamp on any preview URL.
 * Used when the user manually triggers a reload.
 */
export function bustPreviewCache(url: string): string {
  const base = url.split('?')[0];
  return `${base}?t=${Date.now()}`;
}
