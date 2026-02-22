import { api } from './api';
import { ApiResponse, AuthTokens, User } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

export interface AuthResponseData {
  user: User;
  tokens: AuthTokens;
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResponseData> {
    const { data } = await api.post<ApiResponse<AuthResponseData>>('/auth/login', payload);
    return data.data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponseData> {
    const { data } = await api.post<ApiResponse<AuthResponseData>>('/auth/register', payload);
    return data.data;
  },

  /**
   * Validates the current access token and returns the authenticated user.
   * Called on app launch to restore a prior session without re-login.
   */
  async getMe(): Promise<User> {
    const { data } = await api.get<ApiResponse<User>>('/auth/me');
    return data.data;
  },

  /**
   * Invalidates the refresh token on the server.
   * Best-effort — we clear local tokens regardless of whether this succeeds.
   */
  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken });
  },
};
