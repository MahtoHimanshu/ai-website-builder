import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { BuildStatus } from '../../types';

interface Props {
  status: BuildStatus;
  message: string;
}

// Maps each build phase to a color and icon
const STATUS_CONFIG: Record<BuildStatus, { color: string; icon: string; pulse: boolean }> = {
  idle:              { color: '#64748B', icon: '○', pulse: false },
  generating_ui:     { color: '#818CF8', icon: '◌', pulse: true  },
  deploying_backend: { color: '#FB923C', icon: '◌', pulse: true  },
  uploading_preview: { color: '#34D399', icon: '◌', pulse: true  },
  ready:             { color: '#34D399', icon: '✓', pulse: false },
  error:             { color: '#F87171', icon: '✗', pulse: false },
};

/**
 * StatusBanner displays the current server-side build pipeline state.
 * Shown between the preview and chat list panels.
 * Hidden when status is 'idle' or message is empty.
 */
export function StatusBanner({ status, message }: Props) {
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;

  // Pulse animation for in-progress states
  useEffect(() => {
    if (!config.pulse) {
      opacityAnim.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [config.pulse, opacityAnim]);

  if (status === 'idle' || !message) return null;

  return (
    <View style={[styles.container, { borderLeftColor: config.color }]}>
      <Animated.Text style={[styles.icon, { color: config.color, opacity: opacityAnim }]}>
        {config.icon}
      </Animated.Text>
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#131825',
    borderLeftWidth: 3,
  },
  icon: { fontSize: 14, marginRight: 8, width: 16 },
  message: { color: '#CBD5E1', fontSize: 12, flex: 1, letterSpacing: 0.2 },
});
