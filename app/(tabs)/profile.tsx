// app/(tabs)/profile.tsx
// User's name, SplitIt ID, static personal QR, and payout wallet setup.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { LogOut, Landmark, Copy, Heart } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import * as Clipboard from 'expo-clipboard';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing(5), paddingBottom: theme.spacing(12) },
    profileCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(6),
      alignItems: 'center',
      marginBottom: theme.spacing(6),
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing(3),
    },
    avatarText: { fontSize: 26, fontWeight: '800', color: theme.colors.primaryDark },
    name: { fontSize: 19, fontWeight: '800', color: theme.colors.text },
    splitIdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.secondaryLight,
      paddingHorizontal: theme.spacing(3.5),
      paddingVertical: theme.spacing(1.5),
      borderRadius: theme.radius.pill,
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(5),
    },
    splitIdText: { color: theme.colors.secondaryDark, fontWeight: '700', fontSize: 13 },
    qrWrap: {
      padding: theme.spacing(4),
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.lg,
    },
    sectionCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(5),
      marginBottom: theme.spacing(4),
    },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: theme.spacing(4) },
    sectionTitle: { fontWeight: '800', color: theme.colors.text, fontSize: 15 },
    label: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted, marginBottom: theme.spacing(1.5) },
    input: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(3),
      color: theme.colors.text,
      marginBottom: theme.spacing(3),
    },
    saveBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(3.5),
      alignItems: 'center',
    },
    saveBtnText: { color: theme.colors.textInverse, fontWeight: '700' },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(3.5),
      marginTop: theme.spacing(2),
    },
    logoutText: { color: theme.colors.danger, fontWeight: '700' },
  })
);

export default function ProfileScreen() {
  const styles = useStyles();
  const { user, logout } = useAuth();
  const [bankName, setBankName] = useState(user?.payoutWallet?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(user?.payoutWallet?.accountNumber ?? '');
  const [accountName, setAccountName] = useState(user?.payoutWallet?.accountName ?? '');

  const handleCopySplitId = async () => {
    if (!user?.splitId) return;
    await Clipboard.setStringAsync(user.splitId);
  };

  const handleSaveWallet = () => {
    if (!bankName || !accountNumber || !accountName) {
      Alert.alert('Missing details', 'Fill in bank name, account number and account name.');
      return;
    }
    Alert.alert('Saved', 'Your payout wallet has been set up for receiving support.');
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.fullName?.[0]?.toUpperCase() ?? 'S'}</Text>
          </View>
          <Text style={styles.name}>{user?.fullName ?? 'SplitIt User'}</Text>
          <Pressable style={styles.splitIdRow} onPress={handleCopySplitId}>
            <Text style={styles.splitIdText}>{user?.splitId ?? '@user_split'}</Text>
            <Copy size={12} color={styles.splitIdText.color as string} />
          </Pressable>

          <View style={styles.qrWrap}>
            <QRCode
              value={JSON.stringify({ splitId: user?.splitId, userId: user?.id })}
              size={150}
              backgroundColor="transparent"
              color={styles.name.color as string}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Heart size={16} color={styles.sectionTitle.color as string} />
            <Text style={styles.sectionTitle}>Support the App / Setup Payout Wallet</Text>
          </View>

          <Text style={styles.label}>Bank Name</Text>
          <TextInput style={styles.input} placeholder="e.g. Wema Bank" value={bankName} onChangeText={setBankName} />

          <Text style={styles.label}>Account Number</Text>
          <TextInput
            style={styles.input}
            placeholder="0123456789"
            keyboardType="numeric"
            value={accountNumber}
            onChangeText={setAccountNumber}
          />

          <Text style={styles.label}>Account Name</Text>
          <TextInput style={styles.input} placeholder="Olateju Olamide" value={accountName} onChangeText={setAccountName} />

          <Pressable style={styles.saveBtn} onPress={handleSaveWallet}>
            <Text style={styles.saveBtnText}>Save Payout Wallet</Text>
          </Pressable>
        </View>

        <Pressable style={styles.logoutBtn} onPress={logout}>
          <LogOut size={16} color={styles.logoutText.color as string} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
