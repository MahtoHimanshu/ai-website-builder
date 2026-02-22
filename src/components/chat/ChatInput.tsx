import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface Props {
  onSend: (message: string) => void;
  onCancel?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

/**
 * ChatInput — the natural language entry point.
 *
 * Design decisions:
 * - Multiline input grows with content (up to maxHeight)
 * - While streaming, the Send button becomes a Stop button
 * - Input is disabled while streaming to prevent overlapping sends
 * - The send action is also triggered by tapping the button (not Enter),
 *   since multiline input uses Enter for newlines
 */
export function ChatInput({ onSend, onCancel, isStreaming, disabled }: Props) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const canSend = text.trim().length > 0 && !isStreaming && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    const trimmed = text.trim();
    setText('');
    onSend(trimmed);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Describe what to build or change..."
          placeholderTextColor="#334155"
          multiline
          maxLength={4000}
          editable={!isStreaming && !disabled}
          returnKeyType="default"
          blurOnSubmit={false}
          textAlignVertical="top"
        />

        {isStreaming ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.stopBtn]}
            onPress={onCancel}
            hitSlop={8}
          >
            <View style={styles.stopIcon} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.sendBtn, !canSend && styles.btnDisabled]}
            onPress={handleSend}
            disabled={!canSend}
            hitSlop={8}
          >
            <Text style={styles.sendArrow}>↑</Text>
          </TouchableOpacity>
        )}
      </View>

      {isStreaming && (
        <View style={styles.streamingIndicator}>
          <ActivityIndicator size="small" color="#6366F1" />
          <Text style={styles.streamingText}>Generating...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0A0D14',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: '#F1F5F9',
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 130,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  sendBtn: { backgroundColor: '#6366F1' },
  stopBtn: { backgroundColor: '#374151' },
  btnDisabled: { opacity: 0.35 },
  sendArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: -2 },
  stopIcon: {
    width: 12,
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 2,
  },

  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  streamingText: { color: '#475569', fontSize: 12 },
});
