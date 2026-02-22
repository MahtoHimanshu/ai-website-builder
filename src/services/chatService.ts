import { api } from './api';
import { ApiResponse, ChatMessage } from '../types';

export const chatService = {
  /**
   * Fetches the conversation history for a project.
   * Used to restore prior messages when opening a project.
   * Live generation goes through SSEClient, not this service.
   */
  async getHistory(projectId: string): Promise<ChatMessage[]> {
    const { data } = await api.get<ApiResponse<ChatMessage[]>>(
      `/projects/${projectId}/messages`,
    );
    return data.data;
  },
};
