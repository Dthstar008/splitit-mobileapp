// app/(auth)/signup.tsx
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
import { ArrowLeft, User as UserIcon, Mail, Phone, Lock } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing(6), paddingBottom: theme.spacing(12) },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing(6),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    heading: { fontSize: 26, fontWeight: '800', color: theme.colors.text, marginBottom: theme.spacing(1) },
    subheading: { fontSize: 14, color: theme.colors.textMuted, marginBottom: theme.spacing(7) },
    inputGroup: { marginBottom: theme.spacing(4) },
    label: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(2) },
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
    },
    errorText: { color: theme.colors.danger, fontSize: 13, marginBottom: theme.spacing(3) },
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      alignItems: 'center',
      marginTop: theme.spacing(3),
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: theme.colors.textInverse, fontWeight: '700', fontSize: 16 },
    switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing(6) },
    switchText: { color: theme.colors.textMuted },
    switchLink: { color: theme.colors.primary, fontWeight: '700' },
  })
);

export default function SignupScreen() {
  const styles = useStyles();
  const { signup, isLoading, error, clearError } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    clearError();
    try {
      await signup({ fullName, email, phone, password });
      // Root layout auto-switches to (tabs) once `user` is set.
    } catch {
      // error already captured in context
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={styles.heading.color as string} />
          </Pressable>

          <Text style={styles.heading}>Create your account</Text>
          <Text style={styles.subheading}>You'll get a unique SplitIt ID automatically.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputRow}>
              <UserIcon size={18} color={styles.subheading.color as string} />
              <TextInput
                style={styles.input}
                placeholder="Olamide Teju"
                placeholderTextColor={styles.subheading.color as string}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Mail size={18} color={styles.subheading.color as string} />
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor={styles.subheading.color as string}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputRow}>
              <Phone size={18} color={styles.subheading.color as string} />
              <TextInput
                style={styles.input}
                placeholder="+234 801 234 5678"
                placeholderTextColor={styles.subheading.color as string}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Lock size={18} color={styles.subheading.color as string} />
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor={styles.subheading.color as string}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          <Pressable
            style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            <Text style={styles.primaryBtnText}>{isLoading ? 'Creating account…' : 'Sign Up'}</Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Already have an account? </Text>
            <Pressable onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.switchLink}>Log In</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
