// app/(tabs)/profile.tsx
// User's name, SplitIt ID, static personal QR, and payout wallet setup.

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { LogOut, Copy, Landmark, CheckCircle2 } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import GlassCard from '../../components/ui/GlassCard';
import PressableScale from '../../components/ui/PressableScale';
import BankPickerModal from '../../components/ui/BankPickerModal';
import * as api from '../../services/api';
import { BankOption } from '../../types';
import * as Clipboard from 'expo-clipboard';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing(5), paddingBottom: theme.spacing(12) },
    // The one "identity" surface on this screen — same glass+glow treatment
    // as the QR card in the Split Engine flow.
    profileCard: {
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
    avatarText: { fontSize: 26, color: theme.colors.primary, fontFamily: theme.font.headingBold },
    name: { fontSize: 19, color: theme.colors.text, fontFamily: theme.font.headingBold },
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
    splitIdText: { color: theme.colors.secondaryDark, fontSize: 13, fontFamily: theme.font.bodyBold },
    // QR codes need real contrast to scan reliably — an explicit white
    // patch regardless of app theme, same justified exception as the
    // basket QR in QRGenerationStep. A theme-colored (near-black) wrap here
    // with a dark foreground would be unscannable.
    qrWrap: {
      padding: theme.spacing(4),
      backgroundColor: '#FFFFFF',
      borderRadius: theme.radius.lg,
    },
    sectionCard: {
      padding: theme.spacing(5),
      marginBottom: theme.spacing(4),
    },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing(2) },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitle: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.headingSemiBold },
    sectionSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginBottom: theme.spacing(4), fontFamily: theme.font.body },
    activePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.primaryLight,
      paddingHorizontal: theme.spacing(2.5),
      paddingVertical: theme.spacing(1),
      borderRadius: theme.radius.pill,
    },
    activePillText: { color: theme.colors.primary, fontSize: 11, fontFamily: theme.font.bodyBold },
    label: { fontSize: 12, color: theme.colors.textMuted, marginBottom: theme.spacing(1.5), fontFamily: theme.font.bodySemiBold },
    bankSelectRow: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(3),
      marginBottom: theme.spacing(3),
    },
    bankSelectText: { fontFamily: theme.font.bodyMedium },
    input: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(3),
      color: theme.colors.text,
      marginBottom: theme.spacing(3),
      fontFamily: theme.font.bodyMedium,
    },
    saveBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(3.5),
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: theme.colors.textInverse, fontFamily: theme.font.bodyBold },
    walletErrorText: { color: theme.colors.danger, fontSize: 12, marginBottom: theme.spacing(3), fontFamily: theme.font.bodyMedium },
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
    logoutText: { color: theme.colors.danger, fontFamily: theme.font.bodyBold },
  })
);

export default function ProfileScreen() {
  const styles = useStyles();
  const { user, token, logout, updateUser } = useAuth();
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(
    user?.payoutWallet ? { name: user.payoutWallet.bankName, code: user.payoutWallet.bankCode, slug: '' } : null
  );
  const [accountNumber, setAccountNumber] = useState(user?.payoutWallet?.accountNumber ?? '');
  const [accountName, setAccountName] = useState(user?.payoutWallet?.accountName ?? '');
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleCopySplitId = async () => {
    if (!user?.splitId) return;
    await Clipboard.setStringAsync(user.splitId);
  };

  const handleSaveWallet = async () => {
    if (!selectedBank || accountNumber.trim().length < 10 || !accountName.trim()) {
      setSaveError('Choose a bank, and fill in a valid account number and account name.');
      return;
    }
    if (!token) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await api.savePayoutWallet(token, {
        bankName: selectedBank.name,
        bankCode: selectedBank.code,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });
      updateUser(updated);
      Alert.alert('Payout wallet saved', 'Baskets you organize will now split settlement automatically — your share to this account, the convenience fee to SplitIt.');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save your payout wallet');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <GlassCard style={styles.profileCard} glow radius={24}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.fullName?.[0]?.toUpperCase() ?? 'S'}</Text>
          </View>
          <Text style={styles.name}>{user?.fullName ?? 'SplitIt User'}</Text>
          <PressableScale style={styles.splitIdRow} onPress={handleCopySplitId}>
            <Text style={styles.splitIdText}>{user?.splitId ?? '@user_split'}</Text>
            <Copy size={12} color={styles.splitIdText.color as string} />
          </PressableScale>

          <View style={styles.qrWrap}>
            <QRCode
              value={JSON.stringify({ splitId: user?.splitId, userId: user?.id })}
              size={150}
              backgroundColor="transparent"
              color="#0B0F0D"
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard} radius={20}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Landmark size={16} color={styles.sectionTitle.color as string} />
              <Text style={styles.sectionTitle}>Payout Wallet</Text>
            </View>
            {user?.splitActive && (
              <View style={styles.activePill}>
                <CheckCircle2 size={12} color={styles.activePillText.color as string} />
                <Text style={styles.activePillText}>Split active</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            Baskets you organize settle here automatically — your full share to this account, the convenience fee to SplitIt, in one step.
          </Text>

          <Text style={styles.label}>Bank</Text>
          <PressableScale style={styles.bankSelectRow} onPress={() => setBankPickerVisible(true)}>
            <Text style={[styles.bankSelectText, { color: selectedBank ? styles.name.color : styles.label.color }]}>
              {selectedBank?.name ?? 'Choose your bank'}
            </Text>
          </PressableScale>

          <Text style={styles.label}>Account Number</Text>
          <TextInput
            style={styles.input}
            placeholder="0123456789"
            placeholderTextColor={styles.label.color as string}
            keyboardType="number-pad"
            maxLength={10}
            value={accountNumber}
            onChangeText={(v) => setAccountNumber(v.replace(/[^0-9]/g, ''))}
          />

          <Text style={styles.label}>Account Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Olateju Olamide"
            placeholderTextColor={styles.label.color as string}
            value={accountName}
            onChangeText={setAccountName}
          />

          {saveError ? <Text style={styles.walletErrorText}>{saveError}</Text> : null}

          <PressableScale
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSaveWallet}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnText}>{isSaving ? 'Saving…' : 'Save Payout Wallet'}</Text>
          </PressableScale>
        </GlassCard>

        <BankPickerModal
          visible={bankPickerVisible}
          onClose={() => setBankPickerVisible(false)}
          onSelect={(bank) => {
            setSelectedBank(bank);
            setBankPickerVisible(false);
          }}
        />

        <PressableScale style={styles.logoutBtn} onPress={logout}>
          <LogOut size={16} color={styles.logoutText.color as string} />
          <Text style={styles.logoutText}>Log Out</Text>
        </PressableScale>
      </ScrollView>
    </SafeAreaView>
  );
}
