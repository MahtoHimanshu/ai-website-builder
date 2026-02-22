import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches unhandled render errors in its subtree.
 *
 * WHY this exists: Without this, a crash in the PreviewWebView or ChatList
 * would unmount the entire screen. Wrapping sub-panels in ErrorBoundary lets
 * the rest of the UI survive isolated failures (e.g., malformed preview data).
 *
 * In production, the componentDidCatch hook should forward to your error
 * tracking service (Sentry, Datadog, etc.).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // TODO: integrate with error tracking service
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.props.fallbackMessage ?? this.state.error?.message ?? 'Unknown error'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F0F14',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#F1F5F9', marginBottom: 8 },
  message: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginBottom: 24 },
  button: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
