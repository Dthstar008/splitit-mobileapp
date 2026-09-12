// components/split-engine/CreateBasketStep.tsx
// STEP A: Create Basket Form — name, total market cost, item list.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList } from 'react-native';
import { Plus, Trash2, ArrowRight } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';
import PressableScale from '../ui/PressableScale';
import { BasketItem } from '../../types';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    container: { padding: theme.spacing(5) },
    label: { fontSize: 13, color: theme.colors.text, marginBottom: theme.spacing(2), fontFamily: theme.font.bodySemiBold },
    input: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(3.5),
      color: theme.colors.text,
      fontSize: 15,
      marginBottom: theme.spacing(4),
      fontFamily: theme.font.body,
    },
    itemRow: {
      flexDirection: 'row',
      gap: theme.spacing(2),
      marginBottom: theme.spacing(3),
    },
    itemNameInput: { flex: 2 },
    itemCostInput: { flex: 1 },
    addItemBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.secondaryLight,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing(3),
      marginBottom: theme.spacing(4),
    },
    addItemBtnText: { color: theme.colors.secondaryDark, fontSize: 13, fontFamily: theme.font.bodyBold },
    itemListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing(2.5),
      paddingHorizontal: theme.spacing(3),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    itemListName: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.bodySemiBold },
    itemListCost: { color: theme.colors.textMuted, fontSize: 13, fontFamily: theme.font.body },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      marginTop: theme.spacing(3),
      shadowColor: theme.colors.glowShadow,
      shadowOpacity: 0.6,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    nextBtnText: { color: theme.colors.textInverse, fontSize: 16, fontFamily: theme.font.bodyBold },
    errorText: { color: theme.colors.danger, fontSize: 12, marginTop: -theme.spacing(2), marginBottom: theme.spacing(3), fontFamily: theme.font.bodyMedium },
  })
);

export default function CreateBasketStep() {
  const styles = useStyles();
  const { draft, updateDraftBasics, addItem, removeItem, goToStep } = useSplit();
  const [itemName, setItemName] = useState('');
  const [itemCost, setItemCost] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleAddItem = () => {
    const cost = parseFloat(itemCost);
    if (!itemName.trim() || isNaN(cost) || cost <= 0) return;
    const item: BasketItem = { id: `item_${Date.now()}`, name: itemName.trim(), cost };
    addItem(item);
    setItemName('');
    setItemCost('');
  };

  const handleNext = () => {
    setLocalError(null);
    if (!draft.title.trim()) return setLocalError('Give your basket a name');
    if (draft.totalMarketCost <= 0) return setLocalError('Enter a valid total market cost');
    goToStep('payers');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Group Basket Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Moni & Co Market Run"
        placeholderTextColor={styles.itemListCost.color as string}
        value={draft.title}
        onChangeText={(t) => updateDraftBasics({ title: t })}
      />

      <Text style={styles.label}>Total Market Cost (₦)</Text>
      <TextInput
        style={styles.input}
        placeholder="45000"
        placeholderTextColor={styles.itemListCost.color as string}
        keyboardType="numeric"
        value={draft.totalMarketCost ? String(draft.totalMarketCost) : ''}
        onChangeText={(t) => updateDraftBasics({ totalMarketCost: parseFloat(t) || 0 })}
      />

      <Text style={styles.label}>Items (optional breakdown)</Text>
      <View style={styles.itemRow}>
        <TextInput
          style={[styles.input, styles.itemNameInput, { marginBottom: 0 }]}
          placeholder="Rice, 1 bag"
          placeholderTextColor={styles.itemListCost.color as string}
          value={itemName}
          onChangeText={setItemName}
        />
        <TextInput
          style={[styles.input, styles.itemCostInput, { marginBottom: 0 }]}
          placeholder="₦"
          placeholderTextColor={styles.itemListCost.color as string}
          keyboardType="numeric"
          value={itemCost}
          onChangeText={setItemCost}
        />
      </View>
      <PressableScale style={styles.addItemBtn} onPress={handleAddItem}>
        <Plus size={16} color={styles.addItemBtnText.color as string} />
        <Text style={styles.addItemBtnText}>Add Item</Text>
      </PressableScale>

      <FlatList
        data={draft.items}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.itemListRow}>
            <Text style={styles.itemListName}>{item.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.itemListCost}>₦{item.cost.toLocaleString()}</Text>
              <Pressable onPress={() => removeItem(item.id)}>
                <Trash2 size={16} color={styles.itemListCost.color as string} />
              </Pressable>
            </View>
          </View>
        )}
      />

      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}

      <PressableScale style={styles.nextBtn} onPress={handleNext}>
        <Text style={styles.nextBtnText}>Add Payers</Text>
        <ArrowRight size={18} color={styles.nextBtnText.color as string} />
      </PressableScale>
    </View>
  );
}
