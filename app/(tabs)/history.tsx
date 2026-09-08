// app/(tabs)/history.tsx
// Scrollable, categorized list of past splits with colored status indicators.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClock } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';
import { Basket } from '../../types';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing(5), paddingTop: theme.spacing(4), paddingBottom: theme.spacing(3) },
    headerTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: theme.spacing(5),
      paddingTop: theme.spacing(5),
      paddingBottom: theme.spacing(2),
      backgroundColor: theme.colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(4),
      marginHorizontal: theme.spacing(5),
      marginBottom: theme.spacing(2.5),
    },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing(3) },
    title: { fontWeight: '700', color: theme.colors.text, fontSize: 14 },
    meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    amount: { fontWeight: '800', color: theme.colors.text, fontSize: 14 },
    emptyState: { alignItems: 'center', paddingVertical: theme.spacing(12), paddingHorizontal: theme.spacing(6) },
    emptyText: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing(3) },
  })
);

function groupByMonth(baskets: Basket[]) {
  const groups: Record<string, Basket[]> = {};
  baskets.forEach((b) => {
    const d = new Date(b.createdAt);
    const key = d.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
    groups[key] = groups[key] || [];
    groups[key].push(b);
  });
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

export default function HistoryScreen() {
  const styles = useStyles();
  const { baskets } = useSplit();
  const sections = useMemo(() => groupByMonth(baskets), [baskets]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionHeader}>{title}</Text>}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <CalendarClock size={40} color={styles.emptyText.color as string} />
            <Text style={styles.emptyText}>Your settled and pending splits will show up here.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSettled = item.status === 'fully_settled';
          return (
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: isSettled ? '#1F9D55' : '#F0B90B' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                  {new Date(item.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} ·{' '}
                  {isSettled ? 'Fully Settled' : 'Pending Payments'}
                </Text>
              </View>
              <Text style={styles.amount}>₦{item.totalMarketCost.toLocaleString()}</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
