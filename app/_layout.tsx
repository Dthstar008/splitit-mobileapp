// app/_layout.tsx
// Root layout: wraps the whole app in providers, then switches between the
// Auth Stack and the Main Tab Stack based on global auth state.

// Imported first, before anything else in the app, so Sentry (if configured
// — see lib/sentry.ts, no-op without EXPO_PUBLIC_SENTRY_DSN) can catch
// errors from everything that follows. A module only evaluates once no
// matter how many import statements reference it, so this single import
// (placed here, before every other import) both runs Sentry.init() first
// and gives the rest of the file isSentryEnabled — no need for a second,
// side-effect-only import of the same module further down.
import { isSentryEnabled } from '../lib/sentry';

import React from 'react';
import { View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ThemeProvider } from '../theme/ThemeContext';
import { palette } from '../theme/colors';
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
  // Theme tokens (theme/colors.ts) reference these families by exact
  // PostScript name (Sora_700Bold, Inter_600SemiBold, ...) — screens render
  // with the system font as an invisible fallback for one frame otherwise,
  // so hold the tree until they're in memory rather than let text reflow.
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: palette.midnight900 }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <SplitProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </SplitProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap still tries to start an app-start span even when Sentry.init
// was never called, which logs a "wrap was called before init" warning
// (harmless, but not the silent no-op the DSN-gating elsewhere promises) —
// so only wrap when there's actually a DSN configured.
export default isSentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;
