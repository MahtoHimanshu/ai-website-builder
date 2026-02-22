import { create } from 'zustand';
import { projectService, CreateProjectPayload } from '../services/projectService';
import { Project } from '../types';
import { buildPreviewUrl, bustPreviewCache } from '../utils/previewUrl';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  previewUrl: string | null;
  previewVersion: number;
  isLoading: boolean;
  error: string | null;

  fetchProjects: () => Promise<void>;
  selectProject: (project: Project) => void;
  createProject: (payload: CreateProjectPayload) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  refreshPreview: () => void;
  updatePreviewUrl: (url: string) => void;
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────
// Mock fallback — used when no backend is reachable.
// Lets the full UI be exercised without a running server.
// ─────────────────────────────────────────────────────────────
function makeMockProject(name: string, description: string): Project {
  const id = `mock-${Date.now()}`;
  return {
    id,
    name,
    description,
    previewUrl: '',
    status: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerId: 'local',
  };
}

const MOCK_PROJECTS: Project[] = [
  {
    id: 'demo-1',
    name: 'Demo: SaaS Landing Page',
    description: 'A clean landing page for a B2B SaaS product',
    previewUrl: '',
    status: 'ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerId: 'local',
  },
];

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  currentProject: null,
  previewUrl: null,
  previewVersion: 0,
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const projects = await projectService.listProjects();
      set({ projects, isLoading: false });
    } catch {
      // No backend — show mock projects so the UI is usable
      set({ projects: MOCK_PROJECTS, isLoading: false });
    }
  },

  selectProject: (project) => {
    // Only build a preview URL if the backend gave us one.
    // Mock/offline projects have previewUrl='' — don't try to load them
    // in the WebView; show the placeholder instead.
    const previewUrl = project.previewUrl ? buildPreviewUrl(project.id) : null;
    set({
      currentProject: project,
      previewUrl,
      previewVersion: Date.now(),
    });
  },

  createProject: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const project = await projectService.createProject(payload);
      set((state) => ({
        projects: [project, ...state.projects],
        isLoading: false,
      }));
      return project;
    } catch {
      // No backend — create a local mock project so the UI flow completes
      const mockProject = makeMockProject(payload.name, payload.description ?? '');
      set((state) => ({
        projects: [mockProject, ...state.projects],
        isLoading: false,
      }));
      return mockProject;
    }
  },

  deleteProject: async (id) => {
    // Optimistic removal — works offline/mock
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    }));
    try {
      await projectService.deleteProject(id);
    } catch {
      // Backend not available; local removal is enough for mock projects
    }
  },

  renameProject: async (id, name) => {
    // Optimistic update
    set((state) => ({
      projects: state.projects.map((p) => p.id === id ? { ...p, name } : p),
      currentProject: state.currentProject?.id === id
        ? { ...state.currentProject, name }
        : state.currentProject,
    }));
    try {
      await projectService.updateProject(id, { name });
    } catch {
      // Backend not available; local update is enough for mock projects
    }
  },

  refreshPreview: () => {
    const { currentProject, previewUrl } = get();
    const newUrl = currentProject
      ? buildPreviewUrl(currentProject.id, Date.now())
      : previewUrl
        ? bustPreviewCache(previewUrl)
        : null;
    set({ previewUrl: newUrl, previewVersion: Date.now() });
  },

  updatePreviewUrl: (url) => {
    const bustedUrl = bustPreviewCache(url);
    set({ previewUrl: bustedUrl, previewVersion: Date.now() });
  },

  clearError: () => set({ error: null }),
}));
