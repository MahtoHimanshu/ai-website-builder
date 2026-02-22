import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { useProjectStore } from '../../stores/projectStore';
import { ENV } from '../../config/env';

interface Props {
  onOpenFullscreen?: () => void;
}

// ─────────────────────────────────────────────────────────────
// PreviewWebView — the live preview panel.
//
// CRITICAL DESIGN PRINCIPLES:
//
// 1. The app NEVER generates or stores HTML/CSS/JS.
//    We only load a URL that the server controls.
//
// 2. Cache busting via `key={previewVersion}`:
//    Changing the `key` prop makes React fully unmount and remount
//    the WebView, which is more reliable than calling reload() or
//    changing just the `source`. This guarantees the server's latest
//    build is always rendered.
//
// 3. cacheEnabled={false}:
//    Prevents the native WebView cache from serving stale HTML.
//    The server overwrites the same file on every build, so the
//    cache would serve the old version without this.
//
// 4. incognito={true}:
//    Prevents session data (cookies, localStorage) from leaking
//    between different projects opened in the same session.
//
// 5. originWhitelist restricts navigation:
//    The preview should NOT be able to navigate to arbitrary URLs.
//    We allowlist only the preview domain and localhost.
//
// 6. No injectedJavaScript that touches page logic:
//    We are a viewer. We do NOT modify the previewed website's JS.
// ─────────────────────────────────────────────────────────────

const PREVIEW_ORIGIN = ENV.previewBaseUrl.startsWith('http://localhost')
  ? 'http://localhost:*'
  : ENV.previewBaseUrl;

export function PreviewWebView({ onOpenFullscreen }: Props) {
  const { previewUrl, previewVersion, refreshPreview } = useProjectStore();

  const handleReload = useCallback(() => {
    refreshPreview();
  }, [refreshPreview]);

  if (!previewUrl) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderIcon}>◌</Text>
        <Text style={styles.placeholderTitle}>No preview yet</Text>
        <Text style={styles.placeholderSub}>
          Send a message below to generate your website
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/*
        key={previewVersion} is the core cache-busting mechanism.
        When the server finishes a build, projectStore increments previewVersion,
        which causes React to unmount the old WebView and mount a fresh one
        pointing to the new URL. No stale cache possible.
      */}
      <WebView
        key={previewVersion}
        source={{ uri: previewUrl }}
        style={styles.webView}
        // ── Security ────────────────────────────────────────────
        originWhitelist={[PREVIEW_ORIGIN]}
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        allowFileAccessFromFileURLs={false}
        // ── Preview freshness ───────────────────────────────────
        cacheEnabled={false}
        incognito={true}
        // ── Feature requirements ────────────────────────────────
        javaScriptEnabled={true}   // Preview is a full JS app
        domStorageEnabled={true}   // Preview may use localStorage
        // ── Disabled features (not needed in preview) ───────────
        geolocationEnabled={false}
        mediaPlaybackRequiresUserAction={true}
        // ── Error handling ──────────────────────────────────────
        renderError={(_domain, code, desc) => (
          <View style={styles.errorView}>
            <Text style={styles.errorTitle}>Preview unavailable</Text>
            <Text style={styles.errorDesc}>{desc} (code {code})</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleReload}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        onHttpError={(event) => {
          console.warn('[PreviewWebView] HTTP error:', event.nativeEvent.statusCode, previewUrl);
        }}
      />

      {/* Minimal toolbar overlaid at the bottom of the preview panel */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarBtn} onPress={handleReload} hitSlop={8}>
          <Text style={styles.toolbarIcon}>↻</Text>
          <Text style={styles.toolbarLabel}>Reload</Text>
        </TouchableOpacity>

        {onOpenFullscreen && (
          <TouchableOpacity style={styles.toolbarBtn} onPress={onOpenFullscreen} hitSlop={8}>
            <Text style={styles.toolbarIcon}>⛶</Text>
            <Text style={styles.toolbarLabel}>Expand</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E1E2E' },
  webView: { flex: 1, backgroundColor: '#FFFFFF' },

  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    paddingHorizontal: 32,
  },
  placeholderIcon: { fontSize: 36, color: '#334155', marginBottom: 12 },
  placeholderTitle: { color: '#94A3B8', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  placeholderSub: { color: '#475569', fontSize: 13, textAlign: 'center' },

  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#0D1117',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toolbarIcon: { color: '#64748B', fontSize: 16 },
  toolbarLabel: { color: '#475569', fontSize: 11 },

  errorView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E2E',
    padding: 24,
  },
  errorTitle: { color: '#F87171', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  errorDesc: { color: '#64748B', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: { color: '#94A3B8', fontSize: 13 },
});
