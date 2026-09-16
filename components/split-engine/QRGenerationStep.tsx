// components/split-engine/QRGenerationStep.tsx
// STEP C: Bill Generation & QR Matrix.
// Uses react-native-qrcode-svg to render the BasketID + payer payload.
// `npx expo install react-native-qrcode-svg react-native-svg` before running.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ArrowRight, Hash } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';
import PressableScale from '../ui/PressableScale';
import GlassCard from '../ui/GlassCard';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    container: { padding: theme.spacing(5), alignItems: 'center' },
    qrCard: {
      padding: theme.spacing(6),
      alignItems: 'center',
      marginBottom: theme.spacing(5),
      width: '100%',
    },
    // A QR code needs real dark-on-light contrast to scan reliably —
    // that doesn't change just because the app around it went dark, so the
    // code itself lives on its own solid white chip rather than trying to
    // render light-on-transparent over the glass card behind it.
    qrChip: {
      backgroundColor: '#FFFFFF',
      padding: theme.spacing(4),
      borderRadius: theme.radius.md,
    },
    basketTitle: { fontSize: 18, color: theme.colors.text, marginTop: theme.spacing(4), fontFamily: theme.font.headingBold },
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
    codeText: { color: theme.colors.secondaryDark, letterSpacing: 1, fontFamily: theme.font.bodyBold },
    totalText: { color: theme.colors.textMuted, marginTop: theme.spacing(3), fontSize: 14, fontFamily: theme.font.body },
    totalAmount: { color: theme.colors.primary, fontSize: 26, fontFamily: theme.font.headingBold },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      width: '100%',
      shadowColor: theme.colors.glowShadow,
      shadowOpacity: 0.6,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    nextBtnText: { color: theme.colors.textInverse, fontSize: 16, fontFamily: theme.font.bodyBold },
  })
);

export default function QRGenerationStep() {
  const styles = useStyles();
  const { finalizedBasket, goToStep } = useSplit();

  // Motivated, not decorative: this is the moment the bill's math is locked
  // in and becomes real (a QR someone will actually scan and pay against).
  // A quiet scale+fade confirms that the preceding "Generating…" call
  // actually landed, rather than the card just appearing mid-list like any
  // other static content.
  // Lazy useState, not useRef().current — see PressableScale.tsx for why.
  const [entrance] = useState(() => new Animated.Value(0));
  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
  }, [finalizedBasket?.id, entrance]);

  if (!finalizedBasket) return null;

  const grandTotal = finalizedBasket.payers.reduce((sum, p) => sum + p.totalDue, 0);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          width: '100%',
          opacity: entrance,
          transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        }}
      >
        {/* The single glowing card per screen — this is the "money locked
            in" moment, so it earns the emphasis the taste skill says to use
            sparingly elsewhere. */}
        <GlassCard style={styles.qrCard} glow>
          <View style={styles.qrChip}>
            <QRCode value={finalizedBasket.qrPayload} size={200} backgroundColor="#FFFFFF" color="#0B0F0D" />
          </View>
          <Text style={styles.basketTitle}>{finalizedBasket.title}</Text>
          <View style={styles.codeRow}>
            <Hash size={14} color={styles.codeText.color as string} />
            <Text style={styles.codeText}>{finalizedBasket.textCode}</Text>
          </View>
          <Text style={styles.totalText}>Total due (incl. fees)</Text>
          <Text style={styles.totalAmount}>₦{grandTotal.toLocaleString()}</Text>
        </GlassCard>
      </Animated.View>

      <PressableScale style={styles.nextBtn} onPress={() => goToStep('dispatch')}>
        <Text style={styles.nextBtnText}>Share This Bill</Text>
        <ArrowRight size={18} color={styles.nextBtnText.color as string} />
      </PressableScale>
    </View>
  );
}
