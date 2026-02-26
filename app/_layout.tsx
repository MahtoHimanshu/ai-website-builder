import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useGitHubStore } from '../src/stores/githubStore';

export default function RootLayout() {
  const loadPersistedPat = useGitHubStore((s) => s.loadPersistedPat);

  // Restore persisted GitHub PAT from SecureStore on every app launch
  useEffect(() => {
    loadPersistedPat();
  }, [loadPersistedPat]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0F0F14" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(app)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
