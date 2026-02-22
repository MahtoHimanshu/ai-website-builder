import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { AntDesign, Ionicons } from '@expo/vector-icons';

export interface GitHubCredentials {
  username: string;
  personalAccessToken: string;
  defaultOrg: string;
  defaultRepo: string;
}

interface FormErrors {
  username?: string;
  personalAccessToken?: string;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (credentials: GitHubCredentials) => void;
  savedCredentials?: GitHubCredentials | null;
}

function maskToken(token: string): string {
  if (token.length <= 7) return token;
  return token.slice(0, 7) + '*'.repeat(token.length - 7);
}

export function GitHubCredentialsModal({ visible, onClose, onSave, savedCredentials }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>(savedCredentials ? 'view' : 'edit');

  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [defaultOrg, setDefaultOrg] = useState('');
  const [defaultRepo, setDefaultRepo] = useState('');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Used to cancel auto-save timer if modal closes early
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      if (savedCredentials) {
        setMode('view');
        setUsername(savedCredentials.username);
        setToken(savedCredentials.personalAccessToken);
        setDefaultOrg(savedCredentials.defaultOrg);
        setDefaultRepo(savedCredentials.defaultRepo);
      } else {
        setMode('edit');
        setUsername('');
        setToken('');
        setDefaultOrg('');
        setDefaultRepo('');
      }
      setErrors({});
      setTokenVisible(false);
      setTestStatus('idle');
      setTestMessage('');
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [visible, savedCredentials]);

  // Reset test status when the user edits the required fields
  const handleUsernameChange = (v: string) => {
    setUsername(v);
    if (errors.username) setErrors(e => ({ ...e, username: undefined }));
    if (testStatus !== 'idle') { setTestStatus('idle'); setTestMessage(''); }
  };
  const handleTokenChange = (v: string) => {
    setToken(v);
    if (errors.personalAccessToken) setErrors(e => ({ ...e, personalAccessToken: undefined }));
    if (testStatus !== 'idle') { setTestStatus('idle'); setTestMessage(''); }
  };

  const handleClose = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setTokenVisible(false);
    setErrors({});
    setTestStatus('idle');
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!username.trim()) newErrors.username = 'GitHub username is required.';
    if (!token.trim()) newErrors.personalAccessToken = 'Personal access token is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestAndSave = async () => {
    if (!validate()) return;

    setTestStatus('testing');
    setTestMessage('');

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const returnedLogin: string = data.login ?? '';

        if (returnedLogin.toLowerCase() !== username.trim().toLowerCase()) {
          // Token is valid but belongs to a different account
          setTestStatus('error');
          setTestMessage(
            `Token is valid but belongs to "@${returnedLogin}", not "@${username.trim()}". Please check the username.`,
          );
          return;
        }

        // Success — show feedback then auto-save after a short pause
        setTestStatus('success');
        setTestMessage(`Connected as @${returnedLogin}`);

        saveTimerRef.current = setTimeout(() => {
          onSave({
            username: username.trim(),
            personalAccessToken: token.trim(),
            defaultOrg: defaultOrg.trim(),
            defaultRepo: defaultRepo.trim(),
          });
        }, 900);

      } else if (response.status === 401) {
        setTestStatus('error');
        setTestMessage('Invalid token — authentication failed. Check your Personal Access Token.');
      } else if (response.status === 403) {
        setTestStatus('error');
        setTestMessage('Token lacks required permissions. Make sure it has the "repo" scope.');
      } else {
        setTestStatus('error');
        setTestMessage(`GitHub returned an unexpected error (HTTP ${response.status}).`);
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Network error. Check your internet connection and try again.');
    }
  };

  const handleEdit = () => {
    setErrors({});
    setTokenVisible(false);
    setTestStatus('idle');
    setTestMessage('');
    setMode('edit');
  };

  const isTesting = testStatus === 'testing';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* ── Header ─────────────────────────────────────── */}
          <View style={styles.headerRow}>
            <View style={styles.ghIconWrap}>
              <AntDesign name="github" size={22} color="#F1F5F9" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>GitHub Credentials</Text>
              <Text style={styles.subtitle}>
                Used in future for automatic repo creation and file sync
              </Text>
            </View>
            {mode === 'view' && (
              <TouchableOpacity style={styles.editChip} onPress={handleEdit} hitSlop={8}>
                <Ionicons name="pencil-outline" size={13} color="#818CF8" />
                <Text style={styles.editChipText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {mode === 'view' ? (
              /* ── View mode ────────────────────────────────── */
              <View style={styles.viewContainer}>
                <ViewRow label="GitHub Username" value={username || '—'} />
                <ViewRow
                  label="Personal Access Token"
                  value={token ? maskToken(token) : '—'}
                  mono
                />
                <ViewRow label="Default Organization / Owner" value={defaultOrg || '—'} />
                <ViewRow label="Default Repository" value={defaultRepo || '—'} />

                <View style={styles.infoBanner}>
                  <Ionicons name="time-outline" size={15} color="#93C5FD" />
                  <Text style={styles.infoBannerText}>
                    Repo creation and file sync are coming soon. Your credentials are saved for when that feature ships.
                  </Text>
                </View>
              </View>
            ) : (
              /* ── Edit mode ────────────────────────────────── */
              <>
                {/* GitHub Username */}
                <Text style={styles.label}>GitHub Username *</Text>
                <TextInput
                  style={[styles.input, errors.username && styles.inputError]}
                  value={username}
                  onChangeText={handleUsernameChange}
                  placeholder="e.g. octocat"
                  placeholderTextColor="#334155"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!isTesting}
                />
                {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}

                {/* Personal Access Token */}
                <Text style={styles.label}>Personal Access Token *</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.tokenInput,
                      errors.personalAccessToken && styles.inputError,
                    ]}
                    value={token}
                    onChangeText={handleTokenChange}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    placeholderTextColor="#334155"
                    secureTextEntry={!tokenVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    editable={!isTesting}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setTokenVisible(v => !v)}
                    hitSlop={4}
                    disabled={isTesting}
                  >
                    <Ionicons
                      name={tokenVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#475569"
                    />
                  </TouchableOpacity>
                </View>
                {errors.personalAccessToken ? (
                  <Text style={styles.errorText}>{errors.personalAccessToken}</Text>
                ) : (
                  <Text style={styles.hint}>
                    Needs repo, workflow scopes. Generate at GitHub → Settings → Developer settings → Personal access tokens.
                  </Text>
                )}

                {/* Default Org */}
                <Text style={styles.label}>Default Organization / Owner</Text>
                <TextInput
                  style={styles.input}
                  value={defaultOrg}
                  onChangeText={setDefaultOrg}
                  placeholder="Leave blank to use your username"
                  placeholderTextColor="#334155"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!isTesting}
                />

                {/* Default Repo */}
                <Text style={styles.label}>Default Repository Name</Text>
                <TextInput
                  style={styles.input}
                  value={defaultRepo}
                  onChangeText={setDefaultRepo}
                  placeholder="e.g. my-ai-website"
                  placeholderTextColor="#334155"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleTestAndSave}
                  editable={!isTesting}
                />

                {/* ── Test result banner ─────────────────────── */}
                {testStatus === 'success' && (
                  <View style={[styles.resultBanner, styles.successBanner]}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#34D399" />
                    <Text style={styles.successText}>{testMessage}</Text>
                  </View>
                )}
                {testStatus === 'error' && (
                  <View style={[styles.resultBanner, styles.errorBanner]}>
                    <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
                    <Text style={styles.errorBannerText}>{testMessage}</Text>
                  </View>
                )}

                <View style={styles.infoBanner}>
                  <Ionicons name="time-outline" size={15} color="#93C5FD" />
                  <Text style={styles.infoBannerText}>
                    Repo creation and file sync are coming soon. Your credentials will be stored securely.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* ── Footer ──────────────────────────────────────── */}
          {mode === 'edit' ? (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleClose}
                disabled={isTesting}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.testSaveBtn,
                  testStatus === 'success' && styles.testSaveBtnSuccess,
                  isTesting && styles.btnBusy,
                ]}
                onPress={handleTestAndSave}
                disabled={isTesting || testStatus === 'success'}
              >
                {isTesting ? (
                  <View style={styles.testingRow}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.testSaveBtnText}>Testing…</Text>
                  </View>
                ) : testStatus === 'success' ? (
                  <View style={styles.testingRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.testSaveBtnText}>Saving…</Text>
                  </View>
                ) : (
                  <View style={styles.testingRow}>
                    <Ionicons name="git-network-outline" size={16} color="#fff" />
                    <Text style={styles.testSaveBtnText}>Test & Save</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Read-only row ─────────────────────────────────────────────────
function ViewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={viewRowStyles.row}>
      <Text style={viewRowStyles.label}>{label}</Text>
      <Text style={[viewRowStyles.value, mono && viewRowStyles.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const viewRowStyles = StyleSheet.create({
  row: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  value: { color: '#F1F5F9', fontSize: 14 },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    color: '#94A3B8',
  },
});

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },

  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    maxHeight: '85%',
  },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  ghIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: { color: '#F1F5F9', fontSize: 16, fontWeight: '700' },
  subtitle: { color: '#64748B', fontSize: 12, marginTop: 2, lineHeight: 16 },

  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3730A3',
  },
  editChipText: { color: '#818CF8', fontSize: 12, fontWeight: '600' },

  viewContainer: { paddingBottom: 8 },

  label: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F1F5F9',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: { borderColor: '#F87171' },
  errorText: { color: '#F87171', fontSize: 12, marginTop: 5 },

  inputWrap: { position: 'relative', justifyContent: 'center' },
  tokenInput: { paddingRight: 46 },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  hint: { color: '#475569', fontSize: 11, lineHeight: 16, marginTop: 6 },

  // ── Test result banners ──────────────────────────────────────────
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  successBanner: {
    backgroundColor: '#052E16',
    borderColor: '#166534',
  },
  successText: { flex: 1, color: '#34D399', fontSize: 13, lineHeight: 18 },
  errorBanner: {
    backgroundColor: '#2D0707',
    borderColor: '#7F1D1D',
  },
  errorBannerText: { flex: 1, color: '#F87171', fontSize: 13, lineHeight: 18 },

  // ── Info banner ──────────────────────────────────────────────────
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#1D3461',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  infoBannerText: { flex: 1, color: '#93C5FD', fontSize: 12, lineHeight: 18 },

  // ── Footer ──────────────────────────────────────────────────────
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  cancelText: { color: '#94A3B8', fontSize: 15, fontWeight: '500' },

  testSaveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testSaveBtnSuccess: { backgroundColor: '#166534' },
  btnBusy: { opacity: 0.8 },
  testingRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  testSaveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  closeBtn: {
    marginTop: 16,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
});
