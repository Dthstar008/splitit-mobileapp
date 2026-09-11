// app/_layout.tsx
// Root layout: wraps the whole app in providers, then switches between the
// Auth Stack and the Main Tab Stack based on global auth state.

// Imported first, before anything else in the app, so Sentry (if configured
// — see lib/sentry.ts, no-op without EXPO_PUBLIC_SENTRY_DSN) can catch
// errors from everything that follows.
import '../lib/sentry';

import React from 'react';
import * as Sentry from '@sentry/react-native';
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

function RootLayout() {
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

// Sentry.wrap is a no-op passthrough when Sentry.init was never called (no
// DSN configured, see lib/sentry.ts) — safe to apply unconditionally.
export default Sentry.wrap(RootLayout);
