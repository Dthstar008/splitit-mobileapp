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

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    container: { padding: theme.spacing(5) },
    label: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(2) },
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
    payerName: { color: theme.colors.text, fontWeight: '700', fontSize: 14 },
    payerId: { color: theme.colors.textMuted, fontSize: 12 },
    payerAmount: { color: theme.colors.primaryDark, fontWeight: '700', fontSize: 14 },
    payerFee: { color: theme.colors.secondaryDark, fontSize: 11, marginTop: 2 },
    summaryCard: {
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.radius.md,
      padding: theme.spacing(4),
      marginTop: theme.spacing(5),
    },
    summaryText: { color: theme.colors.primaryDark, fontWeight: '600', fontSize: 13 },
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
    backBtnText: { color: theme.colors.text, fontWeight: '700' },
    finalizeBtn: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
    },
    finalizeBtnDisabled: { opacity: 0.6 },
    finalizeBtnText: { color: theme.colors.textInverse, fontWeight: '700' },
    errorText: { color: theme.colors.danger, fontSize: 12, marginTop: theme.spacing(2) },
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

  const preview = draft.totalMarketCost > 0 && draft.payerHandles.length > 0
    ? computeSplitDistribution(draft.totalMarketCost, draft.payerHandles)
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
        <Pressable style={styles.addBtn} onPress={handleAdd}>
          <UserPlus size={20} color="#fff" />
        </Pressable>
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
        renderItem={({ item, index }) => (
          <View style={styles.payerCard}>
            <View>
              <Text style={styles.payerName}>{item.name}</Text>
              {item.splitId ? <Text style={styles.payerId}>{item.splitId}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.payerAmount}>₦{item.totalDue.toLocaleString()}</Text>
              <Text style={styles.payerFee}>incl. ₦{item.feeAmount.toLocaleString()} fee</Text>
            </View>
            <Pressable onPress={() => removePayer(index)} style={{ marginLeft: 10 }}>
              <Trash2 size={16} color={styles.payerId.color as string} />
            </Pressable>
          </View>
        )}
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
        <Pressable style={styles.backBtn} onPress={() => goToStep('create')}>
          <ArrowLeft size={16} color={styles.backBtnText.color as string} />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.finalizeBtn, isSubmitting && styles.finalizeBtnDisabled]}
          onPress={handleFinalize}
          disabled={isSubmitting || draft.payerHandles.length === 0}
        >
          <Text style={styles.finalizeBtnText}>{isSubmitting ? 'Generating…' : 'Generate Bill & QR'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
