// components/split-engine/DispatchActionsStep.tsx
// STEP D: Multi-Channel Dispatch — WhatsApp, Email, Text Code display.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MessageCircle, Mail, Copy, CheckCircle } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';
import * as api from '../../services/api';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    container: { padding: theme.spacing(5) },
    codeCard: {
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.radius.lg,
      padding: theme.spacing(5),
      alignItems: 'center',
      marginBottom: theme.spacing(6),
    },
    codeLabel: { color: theme.colors.primaryDark, fontSize: 12, fontWeight: '600', marginBottom: theme.spacing(1) },
    codeValue: { color: theme.colors.primaryDark, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(3),
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing(4),
      marginBottom: theme.spacing(3),
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    whatsappIcon: { backgroundColor: '#DDF4E4' },
    emailIcon: { backgroundColor: theme.colors.secondaryLight },
    actionTitle: { fontWeight: '700', color: theme.colors.text, fontSize: 15 },
    actionSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    doneBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      alignItems: 'center',
      marginTop: theme.spacing(5),
    },
    doneBtnText: { color: theme.colors.textInverse, fontWeight: '700', fontSize: 16 },
  })
);

export default function DispatchActionsStep() {
  const styles = useStyles();
  const { finalizedBasket, closeSplitEngine } = useSplit();
  const [copied, setCopied] = useState(false);

  if (!finalizedBasket) return null;

  const handleWhatsApp = async () => {
    const { url } = await api.dispatchViaWhatsApp(finalizedBasket);
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not available', 'Install WhatsApp to share directly, or copy the code instead.');
    }
  };

  const handleEmail = async () => {
    await api.dispatchViaEmail(finalizedBasket, []);
    Alert.alert('Sent', 'Bill breakdown dispatched via email to added payers.');
  };

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(finalizedBasket.textCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>TEXT CODE</Text>
        <Text style={styles.codeValue}>{finalizedBasket.textCode}</Text>
      </View>

      <Pressable style={styles.actionBtn} onPress={handleWhatsApp}>
        <View style={[styles.iconWrap, styles.whatsappIcon]}>
          <MessageCircle size={20} color="#1F9D55" />
        </View>
        <View>
          <Text style={styles.actionTitle}>Share via WhatsApp</Text>
          <Text style={styles.actionSubtitle}>Sends the bill breakdown + code</Text>
        </View>
      </Pressable>

      <Pressable style={styles.actionBtn} onPress={handleEmail}>
        <View style={[styles.iconWrap, styles.emailIcon]}>
          <Mail size={20} color={styles.codeLabel.color as string} />
        </View>
        <View>
          <Text style={styles.actionTitle}>Share via Email</Text>
          <Text style={styles.actionSubtitle}>Notify all payers by email</Text>
        </View>
      </Pressable>

      <Pressable style={styles.actionBtn} onPress={handleCopyCode}>
        <View style={[styles.iconWrap, { backgroundColor: '#F0F0F0' }]}>
          {copied ? <CheckCircle size={20} color="#1F9D55" /> : <Copy size={20} color={styles.actionTitle.color as string} />}
        </View>
        <View>
          <Text style={styles.actionTitle}>{copied ? 'Copied!' : 'Copy Text Code'}</Text>
          <Text style={styles.actionSubtitle}>Anyone can type this into their app</Text>
        </View>
      </Pressable>

      <Pressable style={styles.doneBtn} onPress={closeSplitEngine}>
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </View>
  );
}
