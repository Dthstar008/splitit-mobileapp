// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, AtSign, Lock } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import PressableScale from '../../components/ui/PressableScale';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { flexGrow: 1, padding: theme.spacing(6), justifyContent: 'center' },
    backBtn: {
      position: 'absolute',
      top: theme.spacing(4),
      left: theme.spacing(6),
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    heading: { fontSize: 26, color: theme.colors.text, marginBottom: theme.spacing(1), fontFamily: theme.font.headingBold },
    subheading: { fontSize: 14, color: theme.colors.textMuted, marginBottom: theme.spacing(7), fontFamily: theme.font.body },
    inputGroup: { marginBottom: theme.spacing(4) },
    label: { fontSize: 13, color: theme.colors.text, marginBottom: theme.spacing(2), fontFamily: theme.font.bodySemiBold },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
    },
    input: {
      flex: 1,
      paddingVertical: theme.spacing(3.5),
      marginLeft: theme.spacing(2.5),
      color: theme.colors.text,
      fontSize: 15,
      fontFamily: theme.font.bodyMedium,
    },
    errorText: { color: theme.colors.danger, fontSize: 13, marginBottom: theme.spacing(3), fontFamily: theme.font.bodyMedium },
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      alignItems: 'center',
      marginTop: theme.spacing(3),
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: theme.colors.textInverse, fontSize: 16, fontFamily: theme.font.bodyBold },
    switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing(6) },
    switchText: { color: theme.colors.textMuted, fontFamily: theme.font.body },
    switchLink: { color: theme.colors.primary, fontFamily: theme.font.bodyBold },
  })
);

export default function LoginScreen() {
  const styles = useStyles();
  const { login, isLoading, error, clearError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    clearError();
    try {
      await login({ identifier, password });
      router.replace('/(tabs)/home');
    } catch {
      // captured in context
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <PressableScale style={styles.backBtn} onPress={() => router.back()}>
        <ArrowLeft size={20} color={styles.heading.color as string} />
      </PressableScale>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Log in to see your active baskets.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number or Email</Text>
            <View style={styles.inputRow}>
              <AtSign size={18} color={styles.subheading.color as string} />
              <TextInput
                style={styles.input}
                placeholder="you@email.com or 0801..."
                placeholderTextColor={styles.subheading.color as string}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Lock size={18} color={styles.subheading.color as string} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={styles.subheading.color as string}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <PressableScale
            style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.primaryBtnText}>{isLoading ? 'Logging in…' : 'Log In'}</Text>
          </PressableScale>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>New to SplitIt!!? </Text>
            <Pressable onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.switchLink}>Sign Up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
