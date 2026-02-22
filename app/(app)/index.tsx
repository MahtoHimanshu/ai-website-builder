import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AntDesign } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useProjectStore } from '../../src/stores/projectStore';
import { useChatStore } from '../../src/stores/chatStore';
import { ProjectCard } from '../../src/components/projects/ProjectCard';
import { CreateProjectModal } from '../../src/components/projects/CreateProjectModal';
import { GitHubCredentialsModal, GitHubCredentials } from '../../src/components/projects/GitHubCredentialsModal';
import { LoadingSpinner } from '../../src/components/common/LoadingSpinner';
import { Project } from '../../src/types';

export default function ProjectListScreen() {
  const {
    projects, fetchProjects, createProject, selectProject,
    deleteProject, renameProject, isLoading,
  } = useProjectStore();
  const { reset: resetChat } = useChatStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [savedGitHubCreds, setSavedGitHubCreds] = useState<GitHubCredentials | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSelectProject = (project: Project) => {
    resetChat();
    selectProject(project);
    router.push(`/(app)/workspace/${project.id}`);
  };

  const handleCreate = async (name: string, description: string) => {
    setIsCreating(true);
    try {
      const project = await createProject({ name, description });
      setShowCreateModal(false);
      resetChat();
      selectProject(project);
      router.push(`/(app)/workspace/${project.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (project: Project) => {
    await deleteProject(project.id);
  };

  const handleRename = async (project: Project, newName: string) => {
    await renameProject(project.id, newName);
  };

  if (isLoading && projects.length === 0) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>WebForge</Text>
          <Text style={styles.subtitle}>AI Website Builder</Text>
        </View>

        {/* GitHub credentials button */}
        <TouchableOpacity
          style={styles.ghBtn}
          onPress={() => setShowGitHub(true)}
          hitSlop={8}
        >
          <AntDesign name="github" size={16} color="#94A3B8" />
          <Text style={styles.ghBtnLabel}>GitHub</Text>
        </TouchableOpacity>
      </View>

      {/* ── Section title ───────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Projects</Text>
        <Text style={styles.projectCount}>{projects.length}</Text>
      </View>

      {/* ── Project list ────────────────────────────────── */}
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={handleSelectProject}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchProjects}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <AntDesign name="folderopen" size={40} color="#334155" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptyText}>
              Tap the + button to create your first AI-powered website
            </Text>
          </View>
        }
        contentContainerStyle={
          projects.length === 0 ? styles.emptyContainer : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── FAB: Create new project ──────────────────────── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <CreateProjectModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
        isLoading={isCreating}
      />

      <GitHubCredentialsModal
        visible={showGitHub}
        onClose={() => setShowGitHub(false)}
        savedCredentials={savedGitHubCreds}
        onSave={(creds) => {
          setSavedGitHubCreds(creds);
          setShowGitHub(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0D14' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  title: { color: '#F1F5F9', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#475569', fontSize: 12, marginTop: 2 },

  ghBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  ghBtnIcon: { fontSize: 14 },
  ghBtnLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  projectCount: { color: '#334155', fontSize: 12, fontWeight: '600' },

  listContent: { paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { color: '#F1F5F9', fontSize: 17, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  fabIcon: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: '300' },
});
