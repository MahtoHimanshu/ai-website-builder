import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { projectService, CreateProjectPayload } from '../services/projectService';
import { Project } from '../types';
import { buildPreviewUrl, bustPreviewCache } from '../utils/previewUrl';
import { getAuthenticatedUser, forkFromTemplate } from '../services/githubService';
import { createVercelProject } from '../services/vercelService';
import { ENV } from '../config/env';
import { useGitHubStore } from './githubStore';
import { zustandAsyncStorage } from '../utils/zustandStorage';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  previewUrl: string | null;
  previewVersion: number;
  isLoading: boolean;
  /** Step label shown during project provisioning, e.g. "Forking repository…" */
  provisioningStatus: string;
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
// Per-project provisioning helpers.
// ─────────────────────────────────────────────────────────────

/** Converts any string to a safe GitHub / Vercel slug. */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'project';
}

/**
 * Forks the template repo + creates a linked Vercel project.
 * Returns { githubRepo, previewUrl } to be stored on the Project.
 * Calls onProgress at each step so the UI can show live status text.
 * Throws on any failure so callers can fall back gracefully.
 */
async function provisionProject(
  projectId: string,
  projectName: string,
  onProgress: (status: string) => void,
): Promise<{ githubRepo: string; previewUrl: string }> {
  const pat          = useGitHubStore.getState().pat;
  const vercelToken  = ENV.vercelToken;

  if (!pat) throw new Error('No GitHub PAT configured.');

  // Derive safe, unique names from project id + slug
  const slug        = slugify(projectName);
  const suffix      = projectId.slice(-8);
  const repoName    = `webforge-${slug}-${suffix}`;
  const vercelName  = repoName; // same slug works for Vercel

  // 1. Resolve GitHub username
  onProgress('Authenticating with GitHub…');
  const owner = await getAuthenticatedUser(pat);

  // 2. Fork template → new repo in user's GitHub account
  onProgress('Forking template repository…');
  const fullRepo = await forkFromTemplate(pat, owner, repoName, projectName);
  // fullRepo = "owner/repoName"

  // 3. Create Vercel project linked to the forked repo (optional)
  let previewUrl = '';
  if (vercelToken) {
    onProgress('Creating Vercel deployment…');
    try {
      const { url } = await createVercelProject(
        vercelToken,
        vercelName,
        owner,
        repoName,
      );
      previewUrl = url;
    } catch (err) {
      // Vercel step failed — repo exists, just no auto-deploy URL
      console.warn('[projectStore] Vercel project creation failed:', err);
    }
  }

  onProgress('Finalising project…');
  return { githubRepo: fullRepo, previewUrl };
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

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
  projects: [],
  currentProject: null,
  previewUrl: null,
  previewVersion: 0,
  isLoading: false,
  provisioningStatus: '',
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
    // Per-project Vercel deployments store a full https:// URL on the project.
    // Mock/offline projects have previewUrl='' — show the placeholder.
    // Legacy projects rely on buildPreviewUrl(project.id) against ENV base.
    let previewUrl: string | null = null;
    if (project.previewUrl.startsWith('https://') || project.previewUrl.startsWith('http://')) {
      previewUrl = `${project.previewUrl}?t=${Date.now()}`;
    } else if (project.previewUrl) {
      previewUrl = buildPreviewUrl(project.id);
    }
    set({
      currentProject: project,
      previewUrl,
      previewVersion: Date.now(),
    });
  },

  createProject: async (payload) => {
    set({ isLoading: true, error: null });

    // ── Step 1: create project record (backend or mock) ──────────────
    let project: Project;
    try {
      project = await projectService.createProject(payload);
    } catch {
      project = makeMockProject(payload.name, payload.description ?? '');
    }

    // ── Step 2: provision GitHub repo + Vercel deployment ────────────
    try {
      const { githubRepo, previewUrl } = await provisionProject(
        project.id,
        project.name,
        (status) => set({ provisioningStatus: status }),
      );
      project = { ...project, githubRepo, previewUrl };
    } catch (err) {
      // Provisioning is best-effort — project still works without it
      console.warn('[projectStore] Provisioning skipped:', err);
    }

    set((state) => ({
      projects: [project, ...state.projects],
      isLoading: false,
      provisioningStatus: '',
    }));
    return project;
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
    let newUrl: string | null = null;
    if (currentProject?.previewUrl.startsWith('http')) {
      // Per-project absolute URL — just bust the cache on it
      newUrl = bustPreviewCache(currentProject.previewUrl);
    } else if (currentProject) {
      newUrl = buildPreviewUrl(currentProject.id, Date.now());
    } else if (previewUrl) {
      newUrl = bustPreviewCache(previewUrl);
    }
    set({ previewUrl: newUrl, previewVersion: Date.now() });
  },

  updatePreviewUrl: (url) => {
    const bustedUrl = bustPreviewCache(url);
    set({ previewUrl: bustedUrl, previewVersion: Date.now() });
  },

  clearError: () => set({ error: null }),
    }),
    {
      name: 'webforge-projects',
      storage: createJSONStorage(() => zustandAsyncStorage),
      // Only persist the projects list; all other fields are derived/transient
      partialize: (state) => ({ projects: state.projects }),
    },
  ),
);
