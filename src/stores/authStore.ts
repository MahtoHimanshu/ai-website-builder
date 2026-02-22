import { create } from 'zustand';
import { authService, LoginPayload, RegisterPayload } from '../services/authService';
import { tokenStorage } from '../utils/tokenStorage';
import { User, AuthTokens } from '../types';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  /** True while login/register/session-restore is in progress */
  isLoading: boolean;
  error: string | null;

  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Called on app launch to restore a persisted session.
   * Validates the token against the server; clears it if invalid.
   */
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────
// WHY Zustand instead of Context API:
// - No Provider wrapper — any module (including non-React service
//   code) can call getState() / subscribe()
// - Granular subscriptions prevent unnecessary re-renders
// - Straightforward async action pattern without boilerplate
// ─────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true, // Start loading until session is restored
  error: null,

  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { user, tokens } = await authService.login(payload);
      await tokenStorage.save(tokens);
      set({ user, tokens, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractMessage(err) });
      throw err; // Let the screen decide whether to re-throw
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { user, tokens } = await authService.register(payload);
      await tokenStorage.save(tokens);
      set({ user, tokens, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractMessage(err) });
      throw err;
    }
  },

  logout: async () => {
    const { tokens } = get();
    // Invalidate refresh token server-side (best-effort — don't block on failure)
    if (tokens?.refreshToken) {
      authService.logout(tokens.refreshToken).catch(() => {});
    }
    await tokenStorage.clear();
    set({ user: null, tokens: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const tokens = await tokenStorage.load();
      if (!tokens) {
        // No stored tokens — go straight to login
        return;
      }
      // Validate by hitting /auth/me — the axios interceptor handles refresh if needed
      const user = await authService.getMe();
      set({ user, tokens, isAuthenticated: true });
    } catch {
      // Token is invalid or expired beyond recovery — force re-login
      try { await tokenStorage.clear(); } catch { /* ignore */ }
      set({ user: null, tokens: null, isAuthenticated: false });
    } finally {
      // ALWAYS release the loading state, regardless of what happened above.
      // Without this, any uncaught error leaves the spinner showing forever.
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const e = error as { response?: { data?: { message?: string } } };
    return e.response?.data?.message ?? 'An error occurred';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
