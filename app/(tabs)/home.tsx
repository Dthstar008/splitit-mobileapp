// app/(tabs)/home.tsx
// Home Tab: active baskets, quick-action chips, floating "Create Food
// Basket Split" button, and text-code lookup search bar.

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Plus, Search, ScanLine, Users2, ShoppingBasket } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useSplit } from '../../context/SplitContext';
import SplitEngineModal from '../../components/split-engine/SplitEngineModal';
import PayWithBankModal from '../../components/pay/PayWithBankModal';
import { Basket, Payer } from '../../types';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    header: { paddingHorizontal: theme.spacing(5), paddingTop: theme.spacing(4) },
    greeting: { fontSize: 13, color: theme.colors.textMuted },
    name: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
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
    searchInput: { flex: 1, paddingVertical: theme.spacing(3), marginLeft: theme.spacing(2), color: theme.colors.text },
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
    chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: theme.spacing(7),
      marginBottom: theme.spacing(3),
      paddingHorizontal: theme.spacing(5),
    },
    basketCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(4),
      marginHorizontal: theme.spacing(5),
      marginBottom: theme.spacing(3),
    },
    basketTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    basketTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, flex: 1, marginRight: 8 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
    statusPillText: { fontSize: 11, fontWeight: '700' },
    basketMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: theme.spacing(1) },
    basketAmount: { color: theme.colors.primaryDark, fontWeight: '800', fontSize: 16, marginTop: theme.spacing(3) },
    emptyState: { alignItems: 'center', paddingVertical: theme.spacing(10), paddingHorizontal: theme.spacing(6) },
    emptyText: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing(3) },
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
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabText: { color: theme.colors.textInverse, fontWeight: '700', fontSize: 14 },
    scannerOverlay: { flex: 1, backgroundColor: '#000' },
    scannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing(5),
      paddingVertical: theme.spacing(4),
      backgroundColor: '#000',
    },
    scannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    scannerClose: { color: '#fff', fontSize: 15, fontWeight: '700' },
    camera: { flex: 1 },
    scannerHint: {
      position: 'absolute',
      bottom: theme.spacing(8),
      left: theme.spacing(5),
      right: theme.spacing(5),
      color: '#fff',
      textAlign: 'center',
      fontSize: 14,
    },
    foundCard: {
      marginTop: theme.spacing(3),
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing(4),
    },
    foundTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 15 },
    foundMeta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    foundPayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing(2.5),
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      marginTop: theme.spacing(3),
    },
    foundPayerName: { color: theme.colors.text, fontWeight: '600', fontSize: 13 },
    foundPayerAmount: { color: theme.colors.primaryDark, fontWeight: '700', fontSize: 13 },
    payBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(2),
    },
    payBtnText: { color: theme.colors.textInverse, fontWeight: '700', fontSize: 12 },
    paidPillText: { color: theme.colors.success, fontWeight: '700', fontSize: 12 },
  })
);

function StatusPill({ status }: { status: Basket['status'] }) {
  const styles = useStyles();
  const isSettled = status === 'fully_settled';
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: isSettled ? '#E6F6EC' : '#FDF3D6' },
      ]}
    >
      <Text style={[styles.statusPillText, { color: isSettled ? '#1F9D55' : '#9C7500' }]}>
        {isSettled ? 'Fully Settled' : 'Pending Payments'}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const styles = useStyles();
  const { user } = useAuth();
  const { baskets, openSplitEngine, lookupByTextCode } = useSplit();
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

  const activeBaskets = baskets.filter((b) => b.status !== 'fully_settled');

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

        <View style={styles.chipsRow}>
          <Pressable style={styles.chip} onPress={openSplitEngine}>
            <ShoppingBasket size={14} color={styles.chipText.color as string} />
            <Text style={styles.chipText}>New Basket</Text>
          </Pressable>
          <Pressable style={styles.chip} onPress={handleScanQr}>
            <ScanLine size={14} color={styles.chipText.color as string} />
            <Text style={styles.chipText}>Scan QR</Text>
          </Pressable>
          <Pressable style={styles.chip}>
            <Users2 size={14} color={styles.chipText.color as string} />
            <Text style={styles.chipText}>My Groups</Text>
          </Pressable>
        </View>

        {searchResult !== undefined && (
          <View>
            {searchResult ? (
              <View style={styles.foundCard}>
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
                      <Pressable style={styles.payBtn} onPress={() => setPayingPayer(p)}>
                        <Text style={styles.payBtnText}>Pay</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: styles.greeting.color as string, marginTop: 12 }}>No basket found for that code.</Text>
            )}
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Active Baskets</Text>
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
          <View style={styles.basketCard}>
            <View style={styles.basketTitleRow}>
              <Text style={styles.basketTitle}>{item.title}</Text>
              <StatusPill status={item.status} />
            </View>
            <Text style={styles.basketMeta}>
              Code {item.textCode} · {item.payers.length} payer{item.payers.length !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.basketAmount}>₦{item.totalMarketCost.toLocaleString()}</Text>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={openSplitEngine}>
        <Plus size={18} color="#fff" />
        <Text style={styles.fabText}>Create Food Basket Split</Text>
      </Pressable>

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
