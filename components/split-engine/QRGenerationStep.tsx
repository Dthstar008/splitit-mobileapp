// components/split-engine/QRGenerationStep.tsx
// STEP C: Bill Generation & QR Matrix.
// Uses react-native-qrcode-svg to render the BasketID + payer payload.
// `npx expo install react-native-qrcode-svg react-native-svg` before running.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ArrowRight, Hash } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    container: { padding: theme.spacing(5), alignItems: 'center' },
    qrCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      padding: theme.spacing(6),
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing(5),
    },
    basketTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginTop: theme.spacing(4) },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.secondaryLight,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(2),
      borderRadius: theme.radius.pill,
      marginTop: theme.spacing(2),
    },
    codeText: { color: theme.colors.secondaryDark, fontWeight: '800', letterSpacing: 1 },
    totalText: { color: theme.colors.textMuted, marginTop: theme.spacing(3), fontSize: 14 },
    totalAmount: { color: theme.colors.primaryDark, fontWeight: '800', fontSize: 22 },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      width: '100%',
    },
    nextBtnText: { color: theme.colors.textInverse, fontWeight: '700', fontSize: 16 },
  })
);

export default function QRGenerationStep() {
  const styles = useStyles();
  const { finalizedBasket, goToStep } = useSplit();

  if (!finalizedBasket) return null;

  const grandTotal = finalizedBasket.payers.reduce((sum, p) => sum + p.totalDue, 0);

  return (
    <View style={styles.container}>
      <View style={styles.qrCard}>
        <QRCode
          value={finalizedBasket.qrPayload}
          size={200}
          backgroundColor="transparent"
          color={styles.basketTitle.color as string}
        />
        <Text style={styles.basketTitle}>{finalizedBasket.title}</Text>
        <View style={styles.codeRow}>
          <Hash size={14} color={styles.codeText.color as string} />
          <Text style={styles.codeText}>{finalizedBasket.textCode}</Text>
        </View>
        <Text style={styles.totalText}>Total due (incl. fees)</Text>
        <Text style={styles.totalAmount}>₦{grandTotal.toLocaleString()}</Text>
      </View>

      <Pressable style={styles.nextBtn} onPress={() => goToStep('dispatch')}>
        <Text style={styles.nextBtnText}>Share This Bill</Text>
        <ArrowRight size={18} color={styles.nextBtnText.color as string} />
      </Pressable>
    </View>
  );
}
