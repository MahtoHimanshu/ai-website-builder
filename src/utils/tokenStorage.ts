import * as SecureStore from 'expo-secure-store';
import { AuthTokens } from '../types';

// ─────────────────────────────────────────────────────────────
// WHY SecureStore instead of AsyncStorage:
// - AsyncStorage is unencrypted and readable on rooted/jailbroken devices
// - SecureStore uses iOS Keychain / Android Keystore — hardware-backed encryption
// - Tokens are credentials; they MUST live in secure storage
// ─────────────────────────────────────────────────────────────

const KEYS = {
  ACCESS_TOKEN: 'auth.accessToken',
  REFRESH_TOKEN: 'auth.refreshToken',
  EXPIRES_AT: 'auth.expiresAt',
} as const;

export const tokenStorage = {
  async save(tokens: AuthTokens): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, tokens.accessToken),
      SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, tokens.refreshToken),
      SecureStore.setItemAsync(KEYS.EXPIRES_AT, String(tokens.expiresAt)),
    ]);
  },

  async load(): Promise<AuthTokens | null> {
    const [accessToken, refreshToken, expiresAtStr] = await Promise.all([
      SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.getItemAsync(KEYS.EXPIRES_AT),
    ]);

    if (!accessToken || !refreshToken || !expiresAtStr) return null;

    return {
      accessToken,
      refreshToken,
      expiresAt: Number(expiresAtStr),
    };
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(KEYS.EXPIRES_AT),
    ]);
  },

  /** Returns true if the stored access token is expired or close to expiring */
  async isAccessTokenExpired(bufferSeconds = 60): Promise<boolean> {
    const tokens = await this.load();
    if (!tokens) return true;
    const nowMs = Date.now();
    const bufferMs = bufferSeconds * 1000;
    return nowMs >= tokens.expiresAt - bufferMs;
  },
};
