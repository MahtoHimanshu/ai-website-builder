import Constants from 'expo-constants';

// ─────────────────────────────────────────────────────────────
// Environment configuration.
//
// WHY this module exists instead of using process.env directly:
// - Single source of truth for all env values
// - Type-safe with defaults for local development
// - Values come from Expo's extra config (app.json / eas.json),
//   which allows per-environment overrides without code changes.
// - NEVER hardcode production URLs in source files.
// ─────────────────────────────────────────────────────────────

interface AppConfig {
  /** Backend REST API base URL, e.g. https://api.yourplatform.com/v1 */
  apiBaseUrl: string;
  /** Preview server base URL, e.g. https://preview.yourplatform.com */
  previewBaseUrl: string;
  /** Vercel API token — used for programmatic project creation */
  vercelToken: string;
  /** Gemini API key — used for AI site.config.ts editing (fallback) */
  geminiApiKey: string;
  /** Z.AI API key — preferred AI provider (GLM-4, OpenAI-compatible) */
  zaiApiKey: string;
  /** SSE connection timeout in milliseconds before treating as dead */
  sseTimeoutMs: number;
  /** Refresh the access token this many seconds before it expires */
  tokenRefreshBufferSeconds: number;
}

const extra = Constants.expoConfig?.extra ?? {};

export const ENV: AppConfig = {
  apiBaseUrl:
    (process.env.EXPO_PUBLIC_API_BASE_URL as string) ||
    extra.apiBaseUrl ||
    'http://localhost:3000/api/v1',

  previewBaseUrl:
    (process.env.EXPO_PUBLIC_PREVIEW_BASE_URL as string) ||
    extra.previewBaseUrl ||
    'http://localhost:3001',

  vercelToken:
    (process.env.EXPO_PUBLIC_VERCEL_TOKEN as string) ||
    extra.vercelToken ||
    '',

  geminiApiKey:
    (process.env.EXPO_PUBLIC_GEMINI_API_KEY as string) ||
    extra.geminiApiKey ||
    '',

  zaiApiKey:
    (process.env.EXPO_PUBLIC_ZAI_API_KEY as string) ||
    extra.zaiApiKey ||
    '',

  sseTimeoutMs: 120_000,

  tokenRefreshBufferSeconds: 60,
};
