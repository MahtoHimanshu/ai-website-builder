import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Project } from '../../types';

interface Props {
  project: Project;
  onPress: (project: Project) => void;
  onDelete: (project: Project) => Promise<void>;
  onRename: (project: Project, newName: string) => Promise<void>;
}

const STATUS_COLORS: Record<Project['status'], string> = {
  idle:       '#64748B',
  generating: '#818CF8',
  deploying:  '#FB923C',
  ready:      '#34D399',
  error:      '#F87171',
};

const STATUS_LABELS: Record<Project['status'], string> = {
  idle:       'Idle',
  generating: 'Generating',
  deploying:  'Deploying',
  ready:      'Ready',
  error:      'Error',
};

export function ProjectCard({ project, onPress, onDelete, onRename }: Props) {
  const statusColor = STATUS_COLORS[project.status] ?? '#64748B';
  const statusLabel = STATUS_LABELS[project.status] ?? project.status;

  const updatedAt = new Date(project.updatedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  // ── Dropdown popover ─────────────────────────────────────────
  const menuBtnRef = useRef<View>(null);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  // ── Centered rename dialog ────────────────────────────────────
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const openDropdown = () => {
    menuBtnRef.current?.measureInWindow((x, y, w, h) => {
      const screenWidth = Dimensions.get('window').width;
      setDropdownPos({
        top: y + h + 6,
        right: screenWidth - x - w,
      });
      setDropdownVisible(true);
    });
  };

  const closeDropdown = () => setDropdownVisible(false);

  const handleEditTitlePress = () => {
    closeDropdown();
    setRenameText(project.name);
    // Small delay so dropdown closes before the new modal opens (avoids double-modal flicker)
    setTimeout(() => setRenameVisible(true), 150);
  };

  const handleDeletePress = () => {
    closeDropdown();
    Alert.alert(
      'Delete Project',
      `Delete "${project.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsBusy(true);
            try { await onDelete(project); } finally { setIsBusy(false); }
          },
        },
      ],
    );
  };

  const handleRenameConfirm = async () => {
    if (!renameText.trim() || isBusy) return;
    setIsBusy(true);
    try {
      await onRename(project, renameText.trim());
      setRenameVisible(false);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      {/* ── Card ──────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: statusColor }]}
        onPress={() => onPress(project)}
        activeOpacity={0.75}
      >
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{project.name}</Text>
            <View style={[styles.statusPill, { borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {project.description ? (
            <Text style={styles.description} numberOfLines={2}>{project.description}</Text>
          ) : null}

          <Text style={styles.date}>Updated {updatedAt}</Text>
        </View>

        <TouchableOpacity
          ref={menuBtnRef}
          style={styles.menuBtn}
          onPress={(e) => { e.stopPropagation(); openDropdown(); }}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#475569" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* ── Inline dropdown ───────────────────────────────────── */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="none"
        onRequestClose={closeDropdown}
      >
        <TouchableWithoutFeedback onPress={closeDropdown}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        <View style={[styles.dropdown, { top: dropdownPos.top, right: dropdownPos.right }]}>
          <TouchableOpacity style={styles.dropdownItem} onPress={handleEditTitlePress}>
            <Ionicons name="pencil-outline" size={15} color="#94A3B8" />
            <Text style={styles.dropdownItemText}>Edit Title</Text>
          </TouchableOpacity>

          <View style={styles.dropdownDivider} />

          <TouchableOpacity style={styles.dropdownItem} onPress={handleDeletePress}>
            <Ionicons name="trash-outline" size={15} color="#F87171" />
            <Text style={[styles.dropdownItemText, styles.dangerText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Centered rename dialog ────────────────────────────── */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => !isBusy && setRenameVisible(false)}>
          <View style={styles.dialogBackdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.dialogWrapper} pointerEvents="box-none">
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Edit Title</Text>

            <TextInput
              style={styles.dialogInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Project name"
              placeholderTextColor="#334155"
              autoFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={handleRenameConfirm}
              selectTextOnFocus
            />

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setRenameVisible(false)}
                disabled={isBusy}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dialogSaveBtn, (!renameText.trim() || isBusy) && styles.btnDisabled]}
                onPress={handleRenameConfirm}
                disabled={!renameText.trim() || isBusy}
              >
                {isBusy
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.dialogSaveText}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    // Uniform border, left overridden dynamically with statusColor
    borderWidth: 1,
    borderColor: '#1E293B',
    borderLeftWidth: 4,   // overrides borderWidth for left side
    overflow: 'hidden',
  },
  body: { flex: 1, padding: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { flex: 1, color: '#F1F5F9', fontSize: 15, fontWeight: '600' },
  statusPill: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2,
  },
  statusText: { fontSize: 10, fontWeight: '600' },
  description: { color: '#64748B', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  date: { color: '#334155', fontSize: 11 },
  menuBtn: {
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 16,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },

  // ── Dropdown ──────────────────────────────────────────────────
  dropdown: {
    position: 'absolute',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropdownItemText: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
  dangerText: { color: '#F87171' },
  dropdownDivider: { height: 1, backgroundColor: '#334155' },

  // ── Centered rename dialog ─────────────────────────────────────
  dialogBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dialogWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dialog: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  dialogTitle: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  dialogInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F1F5F9',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
  },
  dialogCancelText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  dialogSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  dialogSaveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },
});
