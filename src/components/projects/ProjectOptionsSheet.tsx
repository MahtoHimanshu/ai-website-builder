import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Project } from '../../types';

interface Props {
  project: Project | null;
  visible: boolean;
  onClose: () => void;
  onDelete: (project: Project) => Promise<void>;
  onRename: (project: Project, newName: string) => Promise<void>;
}

type Mode = 'menu' | 'rename';

export function ProjectOptionsSheet({ project, visible, onClose, onDelete, onRename }: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const [renameText, setRenameText] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const handleClose = () => {
    setMode('menu');
    setRenameText('');
    onClose();
  };

  const handleDeletePress = async () => {
    if (!project) return;
    setIsBusy(true);
    try {
      await onDelete(project);
      handleClose();
    } finally {
      setIsBusy(false);
    }
  };

  const handleRenameOpen = () => {
    setRenameText(project?.name ?? '');
    setMode('rename');
  };

  const handleRenameConfirm = async () => {
    if (!project || !renameText.trim()) return;
    setIsBusy(true);
    try {
      await onRename(project, renameText.trim());
      handleClose();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.handle} />

        {mode === 'menu' ? (
          <>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {project?.name ?? 'Project'}
            </Text>

            <TouchableOpacity
              style={styles.option}
              onPress={handleRenameOpen}
              disabled={isBusy}
            >
              <Ionicons name="pencil-outline" size={20} color="#F1F5F9" />
              <Text style={styles.optionLabel}>Edit Title</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            <TouchableOpacity
              style={styles.option}
              onPress={handleDeletePress}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#F87171" />
              ) : (
                <Ionicons name="trash-outline" size={20} color="#F87171" />
              )}
              <Text style={[styles.optionLabel, styles.dangerLabel]}>Delete Project</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={isBusy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sheetTitle}>Edit Title</Text>

            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Project name"
              placeholderTextColor="#334155"
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={handleRenameConfirm}
            />

            <View style={styles.renameActions}>
              <TouchableOpacity
                style={styles.renameCancelBtn}
                onPress={handleClose}
                disabled={isBusy}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.renameSaveBtn,
                  (!renameText.trim() || isBusy) && styles.btnDisabled,
                ]}
                onPress={handleRenameConfirm}
                disabled={!renameText.trim() || isBusy}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.renameSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1E293B',
  },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  separator: {
    height: 1,
    backgroundColor: '#1E293B',
    marginHorizontal: -20,
    marginVertical: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 4,
  },
  optionLabel: {
    color: '#F1F5F9',
    fontSize: 16,
  },
  dangerLabel: { color: '#F87171' },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  cancelText: { color: '#94A3B8', fontSize: 16, fontWeight: '500' },

  // Rename mode
  renameInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F1F5F9',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  renameActions: {
    flexDirection: 'row',
    gap: 12,
  },
  renameCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  renameSaveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  renameSaveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },
});
