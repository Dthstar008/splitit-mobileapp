// components/pay/PayWithBankModal.tsx
// "Pay with Bank" — launched when a payer taps Pay on a basket found via
// text-code search or QR scan (see app/(tabs)/home.tsx). Alternative to the
// virtual-account transfer-in flow: the payer picks their own bank, enters
// their account number, and Paystack charges it directly via OTP (or PIN,
// for the smaller set of banks that use it) instead.
//
// Step machine: 'bank' -> 'account' -> 'otp' -> 'result'. The 'otp' step is
// skipped straight to 'result' if the charge succeeds without one (that's
// how it behaves for a handful of Paystack-supported banks).

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Search, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react-native';
import { createStyles } from '../../theme/ThemeContext';
import * as api from '../../services/api';
import { BankOption, Basket, Payer } from '../../types';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      maxHeight: '85%',
      minHeight: '50%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing(5),
      paddingTop: theme.spacing(5),
      paddingBottom: theme.spacing(3),
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payerSummary: {
      marginHorizontal: theme.spacing(5),
      marginBottom: theme.spacing(3),
      padding: theme.spacing(4),
      backgroundColor: theme.colors.primaryLight,
      borderRadius: theme.radius.md,
    },
    payerSummaryName: { color: theme.colors.primaryDark, fontWeight: '700', fontSize: 14 },
    payerSummaryAmount: { color: theme.colors.primaryDark, fontWeight: '800', fontSize: 18, marginTop: 2 },
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
    searchInput: { flex: 1, paddingVertical: theme.spacing(3), marginLeft: theme.spacing(2), color: theme.colors.text },
    bankRow: {
      paddingVertical: theme.spacing(3.5),
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    bankName: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
    centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing(10) },
    mutedText: { color: theme.colors.textMuted, marginTop: theme.spacing(2), textAlign: 'center' },
    selectedBankCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      padding: theme.spacing(4),
      marginBottom: theme.spacing(4),
    },
    label: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing(2) },
    input: {
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(3.5),
      color: theme.colors.text,
      fontSize: 16,
      letterSpacing: 1,
    },
    changeLink: { color: theme.colors.primaryDark, fontWeight: '700', fontSize: 13 },
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      alignItems: 'center',
      marginTop: theme.spacing(5),
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: theme.colors.textInverse, fontWeight: '700', fontSize: 15 },
    errorText: { color: theme.colors.danger, fontSize: 12, marginTop: theme.spacing(2) },
    resultIconWrap: { alignItems: 'center', marginTop: theme.spacing(6) },
    resultTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginTop: theme.spacing(4) },
    resultMessage: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing(2), paddingHorizontal: theme.spacing(4) },
  })
);

type Step = 'bank' | 'account' | 'otp' | 'result';

interface Props {
  visible: boolean;
  basket: Basket;
  payer: Payer;
  onClose: () => void;
}

export default function PayWithBankModal({ visible, basket, payer, onClose }: Props) {
  const styles = useStyles();
  const [step, setStep] = useState<Step>('bank');
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  // Reset to a clean state every time this is opened for a (possibly
  // different) payer, rather than carrying over stale selections.
  useEffect(() => {
    if (!visible) return;
    setStep('bank');
    setBankSearch('');
    setSelectedBank(null);
    setAccountNumber('');
    setOtp('');
    setReference(null);
    setError(null);
    setResultOk(false);
    setResultMessage('');

    setBanksLoading(true);
    setBanksError(null);
    api
      .listBanks()
      .then(setBanks)
      .catch((e: unknown) => setBanksError(e instanceof Error ? e.message : 'Could not load bank list'))
      .finally(() => setBanksLoading(false));
  }, [visible, payer.id]);

  const filteredBanks = bankSearch.trim()
    ? banks.filter((b) => b.name.toLowerCase().includes(bankSearch.trim().toLowerCase()))
    : banks;

  const handleSelectBank = (bank: BankOption) => {
    setSelectedBank(bank);
    setError(null);
    setStep('account');
  };

  const handleSubmitAccount = async () => {
    if (!selectedBank) return;
    if (accountNumber.trim().length < 10) {
      setError('Enter a valid 10-digit account number.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.chargeBankAccount(basket.id, payer.id, {
        bankCode: selectedBank.code,
        accountNumber: accountNumber.trim(),
      });

      if (result.status === 'send_otp' || result.status === 'send_pin') {
        setReference(result.reference ?? null);
        setStep('otp');
      } else if (result.status === 'success') {
        setReference(result.reference ?? null);
        setResultOk(true);
        setResultMessage('Payment submitted. It may take a moment to reflect on the basket.');
        setStep('result');
      } else {
        setResultOk(false);
        setResultMessage(result.message ?? 'Could not charge that account. Please try again.');
        setStep('result');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the charge');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!reference) return;
    if (otp.trim().length < 4) {
      setError('Enter the code you received.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.submitChargeOtp(basket.id, payer.id, { reference, otp: otp.trim() });
      if (result.status === 'success') {
        setResultOk(true);
        setResultMessage('Payment submitted. It may take a moment to reflect on the basket.');
        setStep('result');
      } else {
        setError(result.message ?? 'That code was not accepted. Try again.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify the code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleForStep: Record<Step, string> = {
    bank: 'Choose your bank',
    account: 'Enter account number',
    otp: 'Enter verification code',
    result: resultOk ? 'Payment submitted' : 'Payment failed',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {(step === 'account' || step === 'otp') && (
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => setStep(step === 'otp' ? 'account' : 'bank')}
                  hitSlop={8}
                >
                  <ArrowLeft size={16} color={styles.headerTitle.color as string} />
                </Pressable>
              )}
              <Text style={styles.headerTitle}>{titleForStep[step]}</Text>
            </View>
            <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={8}>
              <X size={16} color={styles.headerTitle.color as string} />
            </Pressable>
          </View>

          <View style={styles.payerSummary}>
            <Text style={styles.payerSummaryName}>Paying for {payer.name}</Text>
            <Text style={styles.payerSummaryAmount}>₦{payer.totalDue.toLocaleString()}</Text>
          </View>

          <View style={styles.body}>
            {step === 'bank' && (
              <>
                <View style={styles.searchRow}>
                  <Search size={16} color={styles.mutedText.color as string} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search banks"
                    placeholderTextColor={styles.mutedText.color as string}
                    value={bankSearch}
                    onChangeText={setBankSearch}
                  />
                </View>

                {banksLoading && (
                  <View style={styles.centerState}>
                    <ActivityIndicator color={styles.payerSummaryName.color as string} />
                    <Text style={styles.mutedText}>Loading banks…</Text>
                  </View>
                )}

                {!banksLoading && banksError && <Text style={styles.errorText}>{banksError}</Text>}

                {!banksLoading && !banksError && (
                  <FlatList
                    data={filteredBanks}
                    keyExtractor={(b) => b.code}
                    scrollEnabled={false}
                    ListEmptyComponent={<Text style={styles.mutedText}>No banks match that search.</Text>}
                    renderItem={({ item }) => (
                      <Pressable style={styles.bankRow} onPress={() => handleSelectBank(item)}>
                        <Text style={styles.bankName}>{item.name}</Text>
                      </Pressable>
                    )}
                  />
                )}
              </>
            )}

            {step === 'account' && selectedBank && (
              <>
                <View style={styles.selectedBankCard}>
                  <Text style={styles.bankName}>{selectedBank.name}</Text>
                  <Pressable onPress={() => setStep('bank')}>
                    <Text style={styles.changeLink}>Change</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Account number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0123456789"
                  placeholderTextColor={styles.mutedText.color as string}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={accountNumber}
                  onChangeText={(v) => setAccountNumber(v.replace(/[^0-9]/g, ''))}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                  onPress={handleSubmitAccount}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryBtnText}>{isSubmitting ? 'Starting…' : 'Continue'}</Text>
                </Pressable>
              </>
            )}

            {step === 'otp' && (
              <>
                <Text style={styles.mutedText}>
                  Enter the code {selectedBank?.name ?? 'your bank'} sent you to authorize this payment.
                </Text>
                <View style={{ height: 12 }} />
                <Text style={styles.label}>Verification code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor={styles.mutedText.color as string}
                  keyboardType="number-pad"
                  maxLength={8}
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, ''))}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <Pressable
                  style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                  onPress={handleSubmitOtp}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryBtnText}>{isSubmitting ? 'Verifying…' : 'Verify & Pay'}</Text>
                </Pressable>
              </>
            )}

            {step === 'result' && (
              <>
                <View style={styles.resultIconWrap}>
                  {resultOk ? (
                    <CheckCircle2 size={56} color={styles.payerSummaryName.color as string} />
                  ) : (
                    <XCircle size={56} color={styles.errorText.color as string} />
                  )}
                  <Text style={styles.resultTitle}>{resultOk ? 'Payment submitted' : 'Payment failed'}</Text>
                  <Text style={styles.resultMessage}>{resultMessage}</Text>
                </View>

                <Pressable style={styles.primaryBtn} onPress={onClose}>
                  <Text style={styles.primaryBtnText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
