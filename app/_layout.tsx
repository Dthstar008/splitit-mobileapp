// app/_layout.tsx
// Root layout: wraps the whole app in providers, then switches between the
// Auth Stack and the Main Tab Stack based on global auth state.

import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../theme/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { SplitProvider } from '../context/SplitContext';

function RootNavigator() {
  const { user } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="(tabs)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <SplitProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </SplitProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
