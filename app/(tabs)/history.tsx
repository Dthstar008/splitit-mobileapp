// app/(tabs)/history.tsx
// Scrollable, categorized list of past splits with colored status indicators.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClock } from 'lucide-react-native';
import { createStyles, useTheme } from '../../theme/ThemeContext';
import { useSplit } from '../../context/SplitContext';
import GlassCard from '../../components/ui/GlassCard';
import { Basket } from '../../types';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing(5), paddingTop: theme.spacing(4), paddingBottom: theme.spacing(3) },
    headerTitle: { fontSize: 22, color: theme.colors.text, fontFamily: theme.font.headingBold },
    sectionHeader: {
      fontSize: 12,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: theme.spacing(5),
      paddingTop: theme.spacing(5),
      paddingBottom: theme.spacing(2),
      backgroundColor: theme.colors.background,
      fontFamily: theme.font.bodyBold,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing(4),
      marginHorizontal: theme.spacing(5),
      marginBottom: theme.spacing(2.5),
    },
    dot: { width: 10, height: 10, borderRadius: 5, marginRight: theme.spacing(3) },
    title: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.bodyBold },
    meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2, fontFamily: theme.font.body },
    amount: { color: theme.colors.text, fontSize: 14, fontFamily: theme.font.headingSemiBold },
    emptyState: { alignItems: 'center', paddingVertical: theme.spacing(12), paddingHorizontal: theme.spacing(6) },
    emptyText: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing(3), fontFamily: theme.font.body },
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
  const theme = useTheme();
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
            <GlassCard style={styles.row} radius={14}>
              <View style={[styles.dot, { backgroundColor: isSettled ? theme.colors.statusSettled : theme.colors.statusPending }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.meta}>
                  {new Date(item.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })} ·{' '}
                  {isSettled ? 'Fully Settled' : 'Pending Payments'}
                </Text>
              </View>
              <Text style={styles.amount}>₦{item.totalMarketCost.toLocaleString()}</Text>
            </GlassCard>
          );
        }}
      />
    </SafeAreaView>
  );
}
