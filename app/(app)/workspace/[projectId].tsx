import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Keyboard,
  Animated,
  Platform,
  useWindowDimensions,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useProjectStore } from '../../../src/stores/projectStore';
import { useChatStore } from '../../../src/stores/chatStore';
import { PreviewWebView } from '../../../src/components/preview/PreviewWebView';
import { ChatList } from '../../../src/components/chat/ChatList';
import { ChatInput } from '../../../src/components/chat/ChatInput';
import { StatusBanner } from '../../../src/components/chat/StatusBanner';
import { ErrorBoundary } from '../../../src/components/common/ErrorBoundary';

const HEADER_HEIGHT = 52;
const PREVIEW_RATIO = 0.38;

export default function WorkspaceScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const { currentProject } = useProjectStore();
  const {
    messages, isStreaming, buildStatus, statusMessage,
    sendMessage, cancelStream, loadHistory, reset,
  } = useChatStore();

  // ─────────────────────────────────────────────────────────────
  // HOW THE KEYBOARD ANIMATION WORKS (Safari / WhatsApp style)
  //
  // The ChatInput is absolutely positioned at the bottom of the
  // chat panel. Its `bottom` value is an Animated.Value.
  //
  // When keyboard appears:
  //   bottom animates from insets.bottom → keyboardHeight
  //   → input slides up to sit just above the keyboard
  //
  // When keyboard disappears:
  //   bottom animates from keyboardHeight → insets.bottom
  //   → input slides back down to the safe bottom edge
  //
  // WHY `bottom` animation instead of KeyboardAvoidingView:
  // KAV's `behavior="height"` on Android measures from the TOP of
  // the screen, not from where the KAV starts. In a split layout
  // (preview + chat), this gives the chat panel more height than
  // available, pushing the input behind the keyboard.
  //
  // WHY `useNativeDriver: false`:
  // `bottom` is a layout property — it cannot run on the UI thread
  // via native driver. However, a single Animated.View moving ~300px
  // over 250ms is imperceptibly smooth in practice.
  //
  // The ChatList receives `bottomPadding` equal to the current input
  // height + keyboard height so the last message is never hidden.
  // ─────────────────────────────────────────────────────────────

  const inputBottom = useRef(new Animated.Value(insets.bottom)).current;
  const [kbHeight, setKbHeight] = useState(0);         // for list paddingBottom
  const [inputHeight, setInputHeight] = useState(76);  // measured via onLayout

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      const kh = e.endCoordinates.height;
      setKbHeight(kh);
      Animated.timing(inputBottom, {
        toValue: kh,
        duration: e.duration || 250,
        useNativeDriver: false,
      }).start();
    });

    const onHide = Keyboard.addListener(hideEvent, (e) => {
      setKbHeight(0);
      Animated.timing(inputBottom, {
        toValue: insets.bottom,
        duration: e.duration || 200,
        useNativeDriver: false,
      }).start();
    });

    return () => { onShow.remove(); onHide.remove(); };
  }, [insets.bottom, inputBottom]);

  const handleInputLayout = (e: LayoutChangeEvent) => {
    setInputHeight(e.nativeEvent.layout.height);
  };

  const previewHeight = Math.floor(
    (screenHeight - insets.top - HEADER_HEIGHT) * PREVIEW_RATIO,
  );

  useEffect(() => {
    if (projectId) loadHistory(projectId);
    return () => reset();
  }, [projectId, loadHistory, reset]);

  const handleSend = useCallback(async (content: string) => {
    if (!projectId) return;
    await sendMessage(projectId, content);
  }, [projectId, sendMessage]);

  const handleOpenFullscreen = useCallback(() => {
    router.push(`/(app)/preview/${projectId}`);
  }, [projectId]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────── */}
      <View style={[styles.header, { height: HEADER_HEIGHT }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.projectName} numberOfLines={1}>
            {currentProject?.name ?? 'Workspace'}
          </Text>
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>PREVIEW</Text>
          </View>
        </View>
        <View style={styles.headerEnd} />
      </View>

      {/* ── Preview panel (fixed height) ─────────────────── */}
      <View style={[styles.previewPanel, { height: previewHeight }]}>
        <ErrorBoundary fallbackMessage="Preview failed to render">
          <PreviewWebView onOpenFullscreen={handleOpenFullscreen} />
        </ErrorBoundary>
      </View>

      <View style={styles.divider} />

      {/* ── Chat panel ───────────────────────────────────── */}
      {/*
        position: 'relative' so the absolutely-positioned input
        anchors to this container, not to the screen.
      */}
      <View style={styles.chatPanel}>
        <StatusBanner status={buildStatus} message={statusMessage} />

        {/*
          bottomPadding reserves space so the last message is always
          visible above the floating input, even when keyboard is open.
        */}
        <ChatList
          messages={messages}
          bottomPadding={inputHeight + kbHeight}
        />

        {/*
          Floating input bar — absolutely pinned to the bottom.
          `bottom` animates with the keyboard: 0 → keyboardHeight.
          Mimics exactly how Safari / WhatsApp handle their toolbars.
        */}
        <Animated.View
          style={[styles.floatingInput, { bottom: inputBottom }]}
          onLayout={handleInputLayout}
        >
          <ChatInput
            onSend={handleSend}
            onCancel={cancelStream}
            isStreaming={isStreaming}
          />
          {/* Fill the gap between input and home indicator when kb is hidden */}
          <View style={[styles.inputSafeArea, { height: insets.bottom }]} />
        </Animated.View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0D14' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    gap: 8,
  },
  backBtn: { padding: 4 },
  backIcon: { color: '#818CF8', fontSize: 30, lineHeight: 30 },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  projectName: { color: '#F1F5F9', fontSize: 15, fontWeight: '600', flexShrink: 1 },
  previewBadge: {
    backgroundColor: '#1D3461',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  previewBadgeText: { color: '#93C5FD', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  headerEnd: { width: 36 },

  previewPanel: { backgroundColor: '#1E1E2E' },
  divider: { height: 6, backgroundColor: '#0D1117' },

  chatPanel: {
    flex: 1,
    position: 'relative', // anchor for absolute input
  },

  floatingInput: {
    position: 'absolute',
    left: 0,
    right: 0,
    // `bottom` is driven by Animated.Value — do not set a static value here
    backgroundColor: '#0A0D14',
  },

  inputSafeArea: {
    backgroundColor: '#0A0D14',
  },
});
