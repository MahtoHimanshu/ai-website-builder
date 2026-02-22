import { api } from './api';
import { ApiResponse, Project } from '../types';

export interface CreateProjectPayload {
  name: string;
  description?: string;
}

export const projectService = {
  async listProjects(): Promise<Project[]> {
    const { data } = await api.get<ApiResponse<Project[]>>('/projects');
    return data.data;
  },

  async getProject(projectId: string): Promise<Project> {
    const { data } = await api.get<ApiResponse<Project>>(`/projects/${projectId}`);
    return data.data;
  },

  async createProject(payload: CreateProjectPayload): Promise<Project> {
    const { data } = await api.post<ApiResponse<Project>>('/projects', payload);
    return data.data;
  },

  async deleteProject(projectId: string): Promise<void> {
    await api.delete(`/projects/${projectId}`);
  },

  async updateProject(projectId: string, patch: Partial<Pick<Project, 'name' | 'description'>>): Promise<Project> {
    const { data } = await api.patch<ApiResponse<Project>>(`/projects/${projectId}`, patch);
    return data.data;
  },
};
