import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import { ENV } from '../config/env';
import { tokenStorage } from '../utils/tokenStorage';
import { ApiError } from '../types';

// ─────────────────────────────────────────────────────────────
// Token Refresh Queue
//
// WHY a queue? If multiple requests fail with 401 simultaneously,
// naïve code would fire multiple refresh requests at once — which
// most backends reject (refresh tokens are single-use).
//
// Solution: The FIRST 401 triggers a refresh. All subsequent 401s
// queue their resolve/reject callbacks and wait for the SAME
// refresh to complete, then replay with the new token.
// ─────────────────────────────────────────────────────────────
let isRefreshing = false;

let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function drainRefreshQueue(error: unknown, token: string | null): void {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  refreshQueue = [];
}

// ─────────────────────────────────────────────────────────────
// Axios Instance
// ─────────────────────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: ENV.apiBaseUrl,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request Interceptor: Attach JWT ───────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const tokens = await tokenStorage.load();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor: Handle 401 → Refresh → Retry ───────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retried?: boolean;
    };

    // Only handle 401 once per request (prevent infinite retry loop)
    if (error.response?.status !== 401 || originalRequest._retried) {
      return Promise.reject(error);
    }

    originalRequest._retried = true;

    if (isRefreshing) {
      // Another refresh is already in flight — queue this request
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const tokens = await tokenStorage.load();
      if (!tokens?.refreshToken) throw new Error('No refresh token available');

      // Use raw axios (not our intercepted instance) to avoid circular intercept
      const { data } = await axios.post(
        `${ENV.apiBaseUrl}/auth/refresh`,
        { refreshToken: tokens.refreshToken },
        { headers: { 'Content-Type': 'application/json' } },
      );

      const newTokens = {
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken,
        expiresAt: data.data.expiresAt,
      };

      await tokenStorage.save(newTokens);
      drainRefreshQueue(null, newTokens.accessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      }

      return api(originalRequest);
    } catch (refreshError) {
      drainRefreshQueue(refreshError, null);
      // Clear invalid tokens — the auth store's session restore will
      // detect the cleared state and redirect to login on next launch.
      await tokenStorage.clear();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);
