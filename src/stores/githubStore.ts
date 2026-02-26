import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { GitHubCredentials } from '../components/projects/GitHubCredentialsModal';

const SECURE_KEY = 'github.pat';

interface GitHubState {
  credentials: GitHubCredentials | null;
  /** Resolved PAT: saved credentials → SecureStore → env variable → null */
  pat: string | null;
  setCredentials: (creds: GitHubCredentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
  /** Load the persisted PAT from SecureStore on app startup. */
  loadPersistedPat: () => Promise<void>;
}

function envPat(): string | null {
  const v = process.env.EXPO_PUBLIC_GITHUB_PAT;
  return v && v.trim() ? v.trim() : null;
}

export const useGitHubStore = create<GitHubState>()((set) => ({
  credentials: null,
  // Eagerly seed from env var; SecureStore is async, loaded via loadPersistedPat()
  pat: envPat(),

  setCredentials: async (creds) => {
    const pat = creds.personalAccessToken?.trim() || null;
    if (pat) {
      await SecureStore.setItemAsync(SECURE_KEY, pat);
    } else {
      await SecureStore.deleteItemAsync(SECURE_KEY);
    }
    set({ credentials: creds, pat: pat ?? envPat() });
  },

  clearCredentials: async () => {
    await SecureStore.deleteItemAsync(SECURE_KEY);
    set({ credentials: null, pat: envPat() });
  },

  loadPersistedPat: async () => {
    try {
      const stored = await SecureStore.getItemAsync(SECURE_KEY);
      if (stored) {
        set({ pat: stored });
      }
      // If nothing in SecureStore, keep whatever is already set (env var / null)
    } catch {
      // SecureStore unavailable (simulator without keychain, etc.) — ignore
    }
  },
}));
