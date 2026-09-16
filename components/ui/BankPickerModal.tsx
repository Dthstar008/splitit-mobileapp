// components/ui/BankPickerModal.tsx
// Standalone bank search/select popup — used by Profile's payout wallet
// form. PayWithBankModal has its own embedded bank-search step with a
// different UX shell (a wizard step, not a popup over other content), so
// this isn't a refactor of that — a second, simpler bank list for a
// different context, sharing the same /payments/banks endpoint and the
// same "code_slug_index" key-collision fix that flow needed.

import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { X, Search } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import * as api from '../../services/api';
import { BankOption } from '../../types';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.glassBorder,
      borderBottomWidth: 0,
      maxHeight: '75%',
      minHeight: '45%',
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
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { paddingHorizontal: theme.spacing(5), paddingBottom: theme.spacing(6) },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
      marginBottom: theme.spacing(3),
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.spacing(3),
      marginLeft: theme.spacing(2),
      color: theme.colors.text,
      fontFamily: theme.font.body,
    },
    bankRow: {
      paddingVertical: theme.spacing(3.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    bankName: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.bodySemiBold },
    centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing(10) },
    mutedText: { color: theme.colors.textMuted, marginTop: theme.spacing(2), textAlign: 'center', fontFamily: theme.font.body },
    errorText: { color: theme.colors.danger, fontSize: 12, fontFamily: theme.font.bodyMedium },
  })
);

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (bank: BankOption) => void;
}

export default function BankPickerModal({ visible, onClose, onSelect }: Props) {
  const styles = useStyles();
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see PayWithBankModal.tsx: adjusting state on `visible` changing, not mirroring it.
    setSearch('');
    setLoading(true);
    setError(null);
    api
      .listBanks()
      .then(setBanks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load bank list'))
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = search.trim()
    ? banks.filter((b) => b.name.toLowerCase().includes(search.trim().toLowerCase()))
    : banks;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choose your bank</Text>
            <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={8}>
              <X size={16} color={styles.headerTitle.color as string} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <View style={styles.searchRow}>
              <Search size={16} color={styles.mutedText.color as string} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search banks"
                placeholderTextColor={styles.mutedText.color as string}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {loading && (
              <View style={styles.centerState}>
                <ActivityIndicator color={styles.headerTitle.color as string} />
                <Text style={styles.mutedText}>Loading banks…</Text>
              </View>
            )}

            {!loading && error && <Text style={styles.errorText}>{error}</Text>}

            {!loading && !error && (
              <FlatList
                data={filtered}
                // Same reasoning as PayWithBankModal.tsx — Paystack's live
                // bank list can list more than one institution under the
                // same settlement code, so code alone isn't a safe key.
                keyExtractor={(b, idx) => `${b.code}_${b.slug}_${idx}`}
                ListEmptyComponent={<Text style={styles.mutedText}>No banks match that search.</Text>}
                renderItem={({ item }) => (
                  <Pressable style={styles.bankRow} onPress={() => onSelect(item)}>
                    <Text style={styles.bankName}>{item.name}</Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
