// components/split-engine/DispatchActionsStep.tsx
// STEP D: Multi-Channel Dispatch — WhatsApp, Email, Text Code display.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MessageCircle, Mail, Copy, CheckCircle } from 'lucide-react-native';
import { createStyles, useTheme } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';
import PressableScale from '../ui/PressableScale';
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
    codeLabel: { color: theme.colors.primaryDark, fontSize: 12, marginBottom: theme.spacing(1), fontFamily: theme.font.bodySemiBold },
    codeValue: { color: theme.colors.primaryDark, fontSize: 28, letterSpacing: 2, fontFamily: theme.font.headingBold },
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
    whatsappIcon: { backgroundColor: theme.colors.primaryLight },
    emailIcon: { backgroundColor: theme.colors.secondaryLight },
    copyIcon: { backgroundColor: theme.colors.surfaceAlt },
    actionTitle: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.bodyBold },
    actionSubtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2, fontFamily: theme.font.body },
    doneBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      alignItems: 'center',
      marginTop: theme.spacing(5),
      shadowColor: theme.colors.glowShadow,
      shadowOpacity: 0.6,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    doneBtnText: { color: theme.colors.textInverse, fontSize: 16, fontFamily: theme.font.bodyBold },
  })
);

export default function DispatchActionsStep() {
  const styles = useStyles();
  const theme = useTheme();
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

      <PressableScale style={styles.actionBtn} onPress={handleWhatsApp}>
        <View style={[styles.iconWrap, styles.whatsappIcon]}>
          <MessageCircle size={20} color={theme.colors.success} />
        </View>
        <View>
          <Text style={styles.actionTitle}>Share via WhatsApp</Text>
          <Text style={styles.actionSubtitle}>Sends the bill breakdown + code</Text>
        </View>
      </PressableScale>

      <PressableScale style={styles.actionBtn} onPress={handleEmail}>
        <View style={[styles.iconWrap, styles.emailIcon]}>
          <Mail size={20} color={styles.codeLabel.color as string} />
        </View>
        <View>
          <Text style={styles.actionTitle}>Share via Email</Text>
          <Text style={styles.actionSubtitle}>Notify all payers by email</Text>
        </View>
      </PressableScale>

      <PressableScale style={styles.actionBtn} onPress={handleCopyCode}>
        <View style={[styles.iconWrap, styles.copyIcon]}>
          {copied ? <CheckCircle size={20} color={theme.colors.success} /> : <Copy size={20} color={styles.actionTitle.color as string} />}
        </View>
        <View>
          <Text style={styles.actionTitle}>{copied ? 'Copied!' : 'Copy Text Code'}</Text>
          <Text style={styles.actionSubtitle}>Anyone can type this into their app</Text>
        </View>
      </PressableScale>

      <PressableScale style={styles.doneBtn} onPress={closeSplitEngine}>
        <Text style={styles.doneBtnText}>Done</Text>
      </PressableScale>
    </View>
  );
}
