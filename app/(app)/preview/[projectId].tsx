import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { useProjectStore } from '../../../src/stores/projectStore';
import { ENV } from '../../../src/config/env';

// ─────────────────────────────────────────────────────────────
// Fullscreen Preview Screen
//
// Renders the exact same stable preview URL as the workspace,
// but full-screen for a better inspection / QA experience.
//
// This is NOT a new deployment — it loads the same file that
// the workspace WebView loads. The URL is the single source of
// truth written by the backend on every build.
//
// The read-only URL bar is intentional: it communicates clearly
// that this is a PREVIEW environment, not production.
// ─────────────────────────────────────────────────────────────

const PREVIEW_ORIGIN = ENV.previewBaseUrl.startsWith('http://localhost')
  ? 'http://localhost:*'
  : ENV.previewBaseUrl;

export default function FullscreenPreviewScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { previewUrl, previewVersion, refreshPreview, currentProject } = useProjectStore();

  const handleRefresh = useCallback(() => {
    refreshPreview();
  }, [refreshPreview]);

  if (!previewUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Preview</Text>
          <View style={styles.spacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>◌</Text>
          <Text style={styles.emptyText}>No preview generated yet</Text>
          <Text style={styles.emptySubtext}>Go back and send a message to build your site</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Strip the ?t= cache-buster for display (it's noise to the user)
  const displayUrl = previewUrl.split('?')[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Minimal header ──────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {currentProject?.name ?? 'Preview'}
        </Text>

        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} hitSlop={8}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* ── Read-only URL bar ────────────────────────────── */}
      {/*
        This communicates to the user (and QA team) exactly which URL
        is being previewed — important for enterprise workflows where
        someone might screenshot or share the preview.
      */}
      <View style={styles.urlBar}>
        <View style={styles.previewPill}>
          <Text style={styles.previewPillText}>PREVIEW</Text>
        </View>
        <Text style={styles.urlText} numberOfLines={1}>
          {displayUrl}
        </Text>
      </View>

      {/* ── Full-screen WebView ──────────────────────────── */}
      {/*
        Identical security settings to the workspace WebView.
        key={previewVersion} ensures refreshPreview() causes a full remount.
      */}
      <WebView
        key={previewVersion}
        source={{ uri: previewUrl }}
        style={styles.webView}
        originWhitelist={[PREVIEW_ORIGIN]}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        allowFileAccessFromFileURLs={false}
        cacheEnabled={false}
        incognito={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={false}
        mediaPlaybackRequiresUserAction={true}
        renderError={(_domain, code, desc) => (
          <View style={styles.errorView}>
            <Text style={styles.errorTitle}>Preview Unavailable</Text>
            <Text style={styles.errorCode}>HTTP {code}</Text>
            <Text style={styles.errorDesc}>{desc}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        onHttpError={(e) => {
          console.warn('[FullscreenPreview] HTTP error', e.nativeEvent.statusCode);
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    gap: 8,
  },
  closeBtn: { padding: 4 },
  closeIcon: { color: '#64748B', fontSize: 18 },
  title: { flex: 1, color: '#F1F5F9', fontSize: 15, fontWeight: '600' },
  spacer: { width: 30 },
  refreshBtn: { padding: 4 },
  refreshIcon: { color: '#64748B', fontSize: 22 },

  urlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1117',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A2235',
    gap: 8,
  },
  previewPill: {
    backgroundColor: '#1D3461',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  previewPillText: { color: '#93C5FD', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  urlText: { flex: 1, color: '#475569', fontSize: 11, fontFamily: 'monospace' },

  webView: { flex: 1, backgroundColor: '#FFFFFF' },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: { fontSize: 40, color: '#334155', marginBottom: 16 },
  emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: '#475569', fontSize: 13, textAlign: 'center' },

  errorView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D1117',
    padding: 24,
  },
  errorTitle: { color: '#F87171', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  errorCode: { color: '#64748B', fontSize: 12, marginBottom: 6 },
  errorDesc: { color: '#475569', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
});
