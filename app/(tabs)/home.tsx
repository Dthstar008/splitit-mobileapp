// app/(tabs)/home.tsx
// Home Tab: active baskets, quick-action chips, floating "Create Food
// Basket Split" button, and text-code lookup search bar.

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Search, ScanLine, Users2, ShoppingBasket, Plus } from 'lucide-react-native';
import { createStyles, useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useSplit } from '../../context/SplitContext';
import SplitEngineModal from '../../components/split-engine/SplitEngineModal';
import PayWithBankModal from '../../components/pay/PayWithBankModal';
import PressableScale from '../../components/ui/PressableScale';
import BasketCardSkeleton from '../../components/ui/BasketCardSkeleton';
import GlassCard from '../../components/ui/GlassCard';
import { Basket, Payer } from '../../types';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing(5), paddingTop: theme.spacing(4) },
    greeting: { fontSize: 13, color: theme.colors.textMuted, fontFamily: theme.font.body },
    name: { fontSize: 23, color: theme.colors.text, marginTop: 2, fontFamily: theme.font.headingBold },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
      marginTop: theme.spacing(5),
    },
    searchInput: {
      flex: 1,
      paddingVertical: theme.spacing(3),
      marginLeft: theme.spacing(2),
      color: theme.colors.text,
      fontFamily: theme.font.body,
    },
    chipsRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(5) },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(2.5),
    },
    chipText: { fontSize: 12, color: theme.colors.text, fontFamily: theme.font.bodySemiBold },
    sectionTitle: {
      fontSize: 15,
      color: theme.colors.text,
      marginTop: theme.spacing(7),
      marginBottom: theme.spacing(3),
      paddingHorizontal: theme.spacing(5),
      fontFamily: theme.font.headingSemiBold,
    },
    // Visual surface (blur/tint/border/shadow) lives in GlassCard now — this
    // is layout-only (padding, spacing between cards).
    basketCard: {
      padding: theme.spacing(4),
      marginHorizontal: theme.spacing(5),
      marginBottom: theme.spacing(3),
    },
    basketTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    basketTitle: {
      fontSize: 15,
      color: theme.colors.text,
      flex: 1,
      marginRight: 8,
      fontFamily: theme.font.bodySemiBold,
    },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
    statusPillText: { fontSize: 11, fontFamily: theme.font.bodyBold },
    basketMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: theme.spacing(1), fontFamily: theme.font.body },
    basketAmount: {
      color: theme.colors.primaryDark,
      fontSize: 16,
      marginTop: theme.spacing(3),
      fontFamily: theme.font.headingBold,
    },
    emptyState: { alignItems: 'center', paddingVertical: theme.spacing(10), paddingHorizontal: theme.spacing(6) },
    emptyText: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing(3), fontFamily: theme.font.body },
    fab: {
      position: 'absolute',
      right: theme.spacing(5),
      bottom: theme.spacing(6),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing(5),
      paddingVertical: theme.spacing(4),
      // A plain dark shadow disappears against a near-black background —
      // this needs to read as a glow, not elevation, to be visible at all.
      shadowColor: theme.colors.glowShadow,
      shadowOpacity: 0.7,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    fabText: { color: theme.colors.textInverse, fontSize: 14, fontFamily: theme.font.bodyBold },
    scannerOverlay: { flex: 1, backgroundColor: '#000' },
    scannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing(5),
      paddingVertical: theme.spacing(4),
      backgroundColor: '#000',
    },
    scannerTitle: { color: '#fff', fontSize: 18, fontFamily: theme.font.headingBold },
    scannerClose: { color: '#fff', fontSize: 15, fontFamily: theme.font.bodyBold },
    camera: { flex: 1 },
    scannerHint: {
      position: 'absolute',
      bottom: theme.spacing(8),
      left: theme.spacing(5),
      right: theme.spacing(5),
      color: '#fff',
      textAlign: 'center',
      fontSize: 14,
      fontFamily: theme.font.body,
    },
    foundCard: {
      marginTop: theme.spacing(3),
      padding: theme.spacing(4),
    },
    foundTitle: { color: theme.colors.text, fontSize: 15, fontFamily: theme.font.headingSemiBold },
    foundMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2, fontFamily: theme.font.body },
    foundPayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing(2.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      marginTop: theme.spacing(3),
    },
    foundPayerName: { color: theme.colors.text, fontSize: 13, fontFamily: theme.font.bodyMedium },
    foundPayerAmount: { color: theme.colors.primaryDark, fontSize: 13, fontFamily: theme.font.bodySemiBold },
    payBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(2),
    },
    payBtnText: { color: theme.colors.textInverse, fontSize: 12, fontFamily: theme.font.bodyBold },
    paidPillText: { color: theme.colors.success, fontSize: 12, fontFamily: theme.font.bodyBold },
  })
);

function StatusPill({ status }: { status: Basket['status'] }) {
  const styles = useStyles();
  const theme = useTheme();
  const isSettled = status === 'fully_settled';
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: isSettled ? theme.colors.primaryLight : theme.colors.secondaryLight },
      ]}
    >
      <Text style={[styles.statusPillText, { color: isSettled ? theme.colors.primaryDark : theme.colors.secondaryDark }]}>
        {isSettled ? 'Fully Settled' : 'Pending Payments'}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const styles = useStyles();
  const { user } = useAuth();
  const { baskets, isLoadingBaskets, openSplitEngine, lookupByTextCode } = useSplit();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState<Basket | null | undefined>(undefined);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [payingPayer, setPayingPayer] = useState<Payer | null>(null);

  const handleScanQr = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to scan a basket QR code.');
        return;
      }
    }

    setHasScanned(false);
    setIsScannerOpen(true);
  };

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (hasScanned) return;
    setHasScanned(true);
    setIsScannerOpen(false);

    let code = data.trim();
    try {
      const payload = JSON.parse(code) as { textCode?: string };
      code = payload.textCode?.trim() ?? code;
    } catch {
    }

    if (!code) {
      setHasScanned(false);
      Alert.alert('Invalid QR code', 'This QR code does not contain a basket code.');
      return;
    }

    setSearchCode(code);
    const result = await lookupByTextCode(code);
    setSearchResult(result);
  };

  const handleSearch = async () => {
    if (!searchCode.trim()) return setSearchResult(undefined);
    const result = await lookupByTextCode(searchCode);
    setSearchResult(result);
  };

  const handleMyGroups = () => {
    Alert.alert('My Groups', 'Saved payer groups are coming soon — for now, add payers fresh on each basket.');
  };

  const activeBaskets = baskets.filter((b) => b.status !== 'fully_settled');
  const showSkeleton = isLoadingBaskets && baskets.length === 0;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{user?.fullName?.split(' ')[0] ?? 'there'} 👋</Text>

        <View style={styles.searchRow}>
          <Search size={16} color={styles.greeting.color as string} />
          <TextInput
            style={styles.searchInput}
            placeholder="Enter text code e.g. SP-9281"
            placeholderTextColor={styles.greeting.color as string}
            value={searchCode}
            autoCapitalize="characters"
            onChangeText={setSearchCode}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>

        {/* Single "create" affordance lives on the FAB below — a "New
            Basket" chip here would just be a second control with the same
            intent, so this row is scan + groups only. */}
        <View style={styles.chipsRow}>
          <PressableScale style={styles.chip} onPress={handleScanQr}>
            <ScanLine size={14} color={styles.chipText.color as string} />
            <Text style={styles.chipText}>Scan QR</Text>
          </PressableScale>
          <PressableScale style={styles.chip} onPress={handleMyGroups}>
            <Users2 size={14} color={styles.chipText.color as string} />
            <Text style={styles.chipText}>My Groups</Text>
          </PressableScale>
        </View>

        {searchResult !== undefined && (
          <View>
            {searchResult ? (
              <GlassCard style={styles.foundCard} radius={16}>
                <Text style={styles.foundTitle}>{searchResult.title}</Text>
                <Text style={styles.foundMeta}>
                  Code {searchResult.textCode} · ₦{searchResult.totalMarketCost.toLocaleString()} total
                </Text>
                {searchResult.payers.map((p) => (
                  <View key={p.id} style={styles.foundPayerRow}>
                    <View>
                      <Text style={styles.foundPayerName}>{p.name}</Text>
                      <Text style={styles.foundPayerAmount}>₦{p.totalDue.toLocaleString()}</Text>
                    </View>
                    {p.status === 'paid' ? (
                      <Text style={styles.paidPillText}>Paid ✓</Text>
                    ) : (
                      <PressableScale style={styles.payBtn} onPress={() => setPayingPayer(p)}>
                        <Text style={styles.payBtnText}>Pay</Text>
                      </PressableScale>
                    )}
                  </View>
                ))}
              </GlassCard>
            ) : (
              <Text style={{ color: styles.greeting.color as string, marginTop: 12, fontFamily: styles.greeting.fontFamily }}>
                No basket found for that code.
              </Text>
            )}
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Active Baskets</Text>
      {showSkeleton ? (
        <View>
          <BasketCardSkeleton />
          <BasketCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={activeBaskets}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ShoppingBasket size={40} color={styles.emptyText.color as string} />
              <Text style={styles.emptyText}>
                No active baskets yet. Tap "Create Food Basket Split" below to start your first group buy.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <GlassCard style={styles.basketCard} glow={item.status === 'fully_settled'}>
              <View style={styles.basketTitleRow}>
                <Text style={styles.basketTitle}>{item.title}</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.basketMeta}>
                Code {item.textCode} · {item.payers.length} payer{item.payers.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.basketAmount}>₦{item.totalMarketCost.toLocaleString()}</Text>
            </GlassCard>
          )}
        />
      )}

      <PressableScale style={styles.fab} onPress={openSplitEngine} scaleTo={0.95}>
        <Plus size={18} color="#fff" />
        <Text style={styles.fabText}>Create Food Basket Split</Text>
      </PressableScale>

      <Modal visible={isScannerOpen} animationType="slide" onRequestClose={() => setIsScannerOpen(false)}>
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Scan basket QR</Text>
            <Pressable onPress={() => setIsScannerOpen(false)} hitSlop={12}>
              <Text style={styles.scannerClose}>Close</Text>
            </Pressable>
          </View>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
          />
          <Text style={styles.scannerHint}>Point your camera at a basket QR code.</Text>
        </View>
      </Modal>

      <SplitEngineModal />

      {payingPayer && searchResult && (
        <PayWithBankModal
          visible
          basket={searchResult}
          payer={payingPayer}
          onClose={() => {
            setPayingPayer(null);
            // Re-fetch in case the payment already landed (live mode) or a
            // previous attempt's webhook caught up — status won't change in
            // mock mode, since nothing there fires a real webhook.
            if (searchResult) lookupByTextCode(searchResult.textCode).then(setSearchResult);
          }}
        />
      )}
    </SafeAreaView>
  );
}
