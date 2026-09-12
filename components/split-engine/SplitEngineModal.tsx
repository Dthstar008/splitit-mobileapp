// components/split-engine/SplitEngineModal.tsx
// Orchestrates STEP A -> B -> C -> D inside a bottom-sheet-style modal
// launched from the Home Tab's floating "Create Food Basket Split" button.

import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { X } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';
import CreateBasketStep from './CreateBasketStep';
import AddPayersStep from './AddPayersStep';
import QRGenerationStep from './QRGenerationStep';
import DispatchActionsStep from './DispatchActionsStep';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      maxHeight: '92%',
      minHeight: '55%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing(5),
      paddingTop: theme.spacing(5),
      paddingBottom: theme.spacing(3),
    },
    headerTitle: { fontSize: 17, color: theme.colors.text, fontFamily: theme.font.headingBold },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDots: { flexDirection: 'row', gap: 6, paddingHorizontal: theme.spacing(5), marginBottom: theme.spacing(2) },
    stepDotTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, overflow: 'hidden' },
    stepDotFill: { flex: 1, borderRadius: 2, backgroundColor: theme.colors.primary },
  })
);

const STEP_TITLES: Record<string, string> = {
  create: 'Create Food Basket Split',
  payers: 'Add Payers',
  qr: 'Bill & QR Code',
  dispatch: 'Share Your Bill',
};

const STEP_ORDER = ['create', 'payers', 'qr', 'dispatch'];

// Fills left-to-right as the user completes a step, rather than snapping —
// motivated by the same reason a progress bar moves smoothly in general:
// it reads as advancement, not a state flip.
function StepDot({ done }: { done: boolean }) {
  const styles = useStyles();
  const fill = useRef(new Animated.Value(done ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fill, { toValue: done ? 1 : 0, duration: 280, useNativeDriver: false }).start();
  }, [done, fill]);

  return (
    <View style={styles.stepDotTrack}>
      <Animated.View
        style={[
          styles.stepDotFill,
          { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

export default function SplitEngineModal() {
  const styles = useStyles();
  const { activeStep, closeSplitEngine } = useSplit();

  const visible = activeStep !== null;
  const currentIndex = activeStep ? STEP_ORDER.indexOf(activeStep) : -1;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={closeSplitEngine}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{activeStep ? STEP_TITLES[activeStep] : ''}</Text>
            <Pressable style={styles.closeBtn} onPress={closeSplitEngine}>
              <X size={16} color={styles.headerTitle.color as string} />
            </Pressable>
          </View>

          <View style={styles.stepDots}>
            {STEP_ORDER.map((step, i) => (
              <StepDot key={step} done={i <= currentIndex} />
            ))}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {activeStep === 'create' && <CreateBasketStep />}
            {activeStep === 'payers' && <AddPayersStep />}
            {activeStep === 'qr' && <QRGenerationStep />}
            {activeStep === 'dispatch' && <DispatchActionsStep />}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
