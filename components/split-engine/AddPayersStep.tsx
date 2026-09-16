// components/split-engine/AddPayersStep.tsx
// STEP B: Add Payers Module — admin adds users by Name/SplitId, engine
// computes the mathematical split distribution live (preview only; the
// authoritative split is computed server-side / via api.createBasket on finalize).

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { UserPlus, Trash2, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';
import { useAuth } from '../../context/AuthContext';
import { computeSplitDistribution } from '../../services/api';
import PressableScale from '../ui/PressableScale';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    container: { padding: theme.spacing(5) },
    label: { fontSize: 13, color: theme.colors.text, marginBottom: theme.spacing(2), fontFamily: theme.font.bodySemiBold },
    row: { flexDirection: 'row', gap: theme.spacing(2) },
    input: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(3.5),
      color: theme.colors.text,
      fontSize: 15,
      flex: 1,
      fontFamily: theme.font.body,
    },
    addBtn: {
      width: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
    },
    payerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing(3.5),
      marginTop: theme.spacing(3),
    },
    payerName: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.bodyBold },
    payerId: { color: theme.colors.textMuted, fontSize: 12, fontFamily: theme.font.body },
    payerAmount: { color: theme.colors.primaryDark, fontSize: 14, fontFamily: theme.font.bodyBold },
    payerFee: { color: theme.colors.secondaryDark, fontSize: 11, marginTop: 2, fontFamily: theme.font.bodyMedium },
    organizerCard: { borderColor: theme.colors.primary, borderStyle: 'dashed' },
    organizerBadge: { color: theme.colors.primary, fontSize: 11, marginTop: 2, fontFamily: theme.font.bodyBold },
    paidText: { color: theme.colors.success, fontSize: 13, fontFamily: theme.font.bodyBold },
    summaryCard: {
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.radius.md,
      padding: theme.spacing(4),
      marginTop: theme.spacing(5),
    },
    summaryText: { color: theme.colors.primaryDark, fontSize: 13, fontFamily: theme.font.bodySemiBold },
    footerRow: { flexDirection: 'row', gap: theme.spacing(3), marginTop: theme.spacing(6) },
    backBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    backBtnText: { color: theme.colors.text, fontFamily: theme.font.bodyBold },
    finalizeBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      shadowColor: theme.colors.glowShadow,
      shadowOpacity: 0.6,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    finalizeBtnDisabled: { opacity: 0.6 },
    finalizeBtnText: { color: theme.colors.textInverse, fontFamily: theme.font.bodyBold },
    errorText: { color: theme.colors.danger, fontSize: 12, marginTop: theme.spacing(2), fontFamily: theme.font.bodyMedium },
  })
);

export default function AddPayersStep() {
  const styles = useStyles();
  const { draft, addPayer, removePayer, finalizeBasket, goToStep, isSubmitting, error } = useSplit();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [splitId, setSplitId] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    addPayer({ name: name.trim(), splitId: splitId.trim() || undefined });
    setName('');
    setSplitId('');
  };

  // The organizer is always one of the payers too — added here purely for
  // an accurate preview (basket.routes.ts adds them again, independently,
  // server-side when the basket is actually saved; this array is never
  // sent as-is). They never pay through the app — see services/api.ts's
  // computeSplitDistribution for why their entry previews as already paid.
  const previewHandles = user
    ? [...draft.payerHandles, { name: user.fullName, splitId: user.splitId, isCreator: true }]
    : draft.payerHandles;
  const preview = draft.totalMarketCost > 0 && draft.payerHandles.length > 0
    ? computeSplitDistribution(draft.totalMarketCost, previewHandles)
    : [];

  const handleFinalize = async () => {
    if (!user) return;
    try {
      await finalizeBasket(user.id);
    } catch {
      // error surfaced via context
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Add by Name or SplitIt ID</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Name (e.g. Temi Tayo)"
          placeholderTextColor={styles.payerId.color as string}
          value={name}
          onChangeText={setName}
        />
        <PressableScale style={styles.addBtn} onPress={handleAdd}>
          {/* addBtn's fill is theme.colors.primary — a light, high-luminance
              green — so the icon needs the same dark textInverse tone every
              other primary-button label uses, not white (fails contrast). */}
          <UserPlus size={20} color={styles.finalizeBtnText.color as string} />
        </PressableScale>
      </View>
      <TextInput
        style={[styles.input, { marginTop: 8 }]}
        placeholder="SplitIt ID (optional) — @temi_split"
        placeholderTextColor={styles.payerId.color as string}
        autoCapitalize="none"
        value={splitId}
        onChangeText={setSplitId}
      />

      <FlatList
        data={preview}
        keyExtractor={(p, idx) => `${p.name}_${idx}`}
        scrollEnabled={false}
        renderItem={({ item, index }) => {
          // Only ever true for the organizer's own preview row (appended
          // last, above) — every payer a person actually types in starts
          // 'pending'. Not removable: you can't take yourself off your own
          // basket, so no Trash2 button for this row.
          const isOrganizer = item.status === 'paid';
          return (
            <View style={[styles.payerCard, isOrganizer && styles.organizerCard]}>
              <View>
                <Text style={styles.payerName}>{item.name}</Text>
                {isOrganizer ? (
                  <Text style={styles.organizerBadge}>You (organizer) — covers this share directly</Text>
                ) : item.splitId ? (
                  <Text style={styles.payerId}>{item.splitId}</Text>
                ) : null}
              </View>
              {isOrganizer ? (
                <Text style={styles.paidText}>Paid ✓</Text>
              ) : (
                <>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.payerAmount}>₦{item.totalDue.toLocaleString()}</Text>
                    <Text style={styles.payerFee}>incl. ₦{item.feeAmount.toLocaleString()} fee</Text>
                  </View>
                  <Pressable onPress={() => removePayer(index)} style={{ marginLeft: 10 }}>
                    <Trash2 size={16} color={styles.payerId.color as string} />
                  </Pressable>
                </>
              )}
            </View>
          );
        }}
      />

      {preview.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>
            <CheckCircle2 size={14} /> {preview.length} payer{preview.length > 1 ? 's' : ''} · Total due incl. fees: ₦
            {preview.reduce((sum, p) => sum + p.totalDue, 0).toLocaleString()}
          </Text>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.footerRow}>
        <PressableScale style={styles.backBtn} onPress={() => goToStep('create')}>
          <ArrowLeft size={16} color={styles.backBtnText.color as string} />
          <Text style={styles.backBtnText}>Back</Text>
        </PressableScale>
        <PressableScale
          style={[styles.finalizeBtn, isSubmitting && styles.finalizeBtnDisabled]}
          onPress={handleFinalize}
          disabled={isSubmitting || draft.payerHandles.length === 0}
        >
          <Text style={styles.finalizeBtnText}>{isSubmitting ? 'Generating…' : 'Generate Bill & QR'}</Text>
        </PressableScale>
      </View>
    </View>
  );
}
