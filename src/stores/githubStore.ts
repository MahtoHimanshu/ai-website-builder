import { create } from 'zustand';
import { GitHubCredentials } from '../components/projects/GitHubCredentialsModal';

interface GitHubState {
  credentials: GitHubCredentials | null;
  /** Resolved PAT: saved credentials → env variable → null */
  pat: string | null;
  setCredentials: (creds: GitHubCredentials) => void;
  clearCredentials: () => void;
}

function resolvedPat(creds: GitHubCredentials | null): string | null {
  if (creds?.personalAccessToken) return creds.personalAccessToken;
  // Fallback: env variable set in .env (EXPO_PUBLIC_ = bundled at build time)
  const envPat = process.env.EXPO_PUBLIC_GITHUB_PAT;
  return envPat && envPat.trim() ? envPat.trim() : null;
}

export const useGitHubStore = create<GitHubState>()((set) => ({
  credentials: null,
  // Eagerly resolve pat from env on startup
  pat: resolvedPat(null),

  setCredentials: (creds) =>
    set({ credentials: creds, pat: resolvedPat(creds) }),

  clearCredentials: () =>
    set({ credentials: null, pat: resolvedPat(null) }),
}));
