// components/pay/PayWithBankModal.tsx
// "Pay with Bank" — launched when a payer taps Pay on a basket found via
// text-code search or QR scan (see app/(tabs)/home.tsx). Alternative to the
// virtual-account transfer-in flow: the payer picks their own bank, enters
// their account number, and Paystack charges it directly via OTP (or PIN,
// or date-of-birth, depending on the bank) instead.
//
// Step machine: 'bank' -> 'account' -> ['otp' | 'birthday'] -> 'result'.
// Which auth step (if any) comes after 'account' isn't fixed — it's
// whatever Paystack's response says it needs next, and that can chain (an
// OTP submission can itself come back asking for a birthday, or vice
// versa), so every submission handler routes its result through the same
// applyChargeResult below rather than each hardcoding "success or bust".

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
import { BankOption, Basket, ChargeResult, Payer } from '../../types';
import GlassCard from '../ui/GlassCard';
import PressableScale from '../ui/PressableScale';

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
    headerTitle: { fontSize: 17, color: theme.colors.text, fontFamily: theme.font.headingBold },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The one "money moment" surface in this flow — what you're paying and
    // to whom — so it's the glass+glow treatment, same as the QR card.
    payerSummary: {
      marginHorizontal: theme.spacing(5),
      marginBottom: theme.spacing(3),
      padding: theme.spacing(4),
    },
    payerSummaryName: { color: theme.colors.primary, fontSize: 14, fontFamily: theme.font.bodySemiBold },
    payerSummaryAmount: { color: theme.colors.text, fontSize: 20, marginTop: 2, fontFamily: theme.font.headingBold },
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
    label: { fontSize: 13, color: theme.colors.text, marginBottom: theme.spacing(2), fontFamily: theme.font.bodySemiBold },
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
      fontFamily: theme.font.bodyMedium,
    },
    changeLink: { color: theme.colors.primary, fontSize: 13, fontFamily: theme.font.bodyBold },
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      alignItems: 'center',
      marginTop: theme.spacing(5),
    },
    primaryBtnDisabled: { opacity: 0.5 },
    primaryBtnText: { color: theme.colors.textInverse, fontSize: 15, fontFamily: theme.font.bodyBold },
    errorText: { color: theme.colors.danger, fontSize: 12, marginTop: theme.spacing(2), fontFamily: theme.font.bodyMedium },
    resultIconWrap: { alignItems: 'center', marginTop: theme.spacing(6) },
    resultTitle: { fontSize: 17, color: theme.colors.text, textAlign: 'center', marginTop: theme.spacing(4), fontFamily: theme.font.headingBold },
    resultMessage: { color: theme.colors.textMuted, textAlign: 'center', marginTop: theme.spacing(2), paddingHorizontal: theme.spacing(4), fontFamily: theme.font.body },
  })
);

type Step = 'bank' | 'account' | 'otp' | 'birthday' | 'result';

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
  const [birthday, setBirthday] = useState(''); // YYYY-MM-DD
  const [reference, setReference] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  // Reset to a clean state every time this is opened for a (possibly
  // different) payer, rather than carrying over stale selections. Adjusting
  // state in response to `visible`/`payer.id` changing, not mirroring them
  // — the documented case where an effect is the right tool
  // (react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-
  // when-a-prop-changes). A `key`-based remount (the rule's suggested
  // alternative for "reset everything") would need restructuring how the
  // parent screen mounts this modal — out of scope for a lint pass.
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep('bank');
    setBankSearch('');
    setSelectedBank(null);
    setAccountNumber('');
    setOtp('');
    setBirthday('');
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

  // Routes a ChargeResult to whatever comes next — a second auth factor
  // (which can differ from whichever one you just submitted; Paystack's
  // multi-factor banks can ask for OTP then birthday, or the reverse),
  // success, or failure. Used after the initial charge AND after each
  // factor submission, so a chained second factor is handled the same way
  // as the first instead of each call site guessing.
  const applyChargeResult = (result: ChargeResult, fallbackErrorMessage: string) => {
    setReference(result.reference ?? reference);
    if (result.status === 'send_otp' || result.status === 'send_pin') {
      setStep('otp');
    } else if (result.status === 'send_birthday') {
      setStep('birthday');
    } else if (result.status === 'success') {
      setResultOk(true);
      setResultMessage('Payment submitted. It may take a moment to reflect on the basket.');
      setStep('result');
    } else {
      // A failure on the FIRST step (initiating the charge) has nowhere
      // established yet to show inline, so it goes to the result screen;
      // a failure on a later factor (wrong OTP/birthday) stays on that
      // step so the payer can just retry the one field, not start over.
      if (step === 'account') {
        setResultOk(false);
        setResultMessage(result.message ?? fallbackErrorMessage);
        setStep('result');
      } else {
        setError(result.message ?? fallbackErrorMessage);
      }
    }
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
      applyChargeResult(result, 'Could not charge that account. Please try again.');
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
      applyChargeResult(result, 'That code was not accepted. Try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify the code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBirthday = async () => {
    if (!reference) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      setError('Enter your date of birth as YYYY-MM-DD.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.submitChargeBirthday(basket.id, payer.id, { reference, birthday });
      applyChargeResult(result, 'That date was not accepted. Try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify your date of birth');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleForStep: Record<Step, string> = {
    bank: 'Choose your bank',
    account: 'Enter account number',
    otp: 'Enter verification code',
    birthday: 'Confirm date of birth',
    result: resultOk ? 'Payment submitted' : 'Payment failed',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {(step === 'account' || step === 'otp' || step === 'birthday') && (
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => setStep(step === 'account' ? 'bank' : 'account')}
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

          <GlassCard style={styles.payerSummary} glow radius={16}>
            <Text style={styles.payerSummaryName}>
              {payer.status === 'underpaid' ? `Topping up for ${payer.name}` : `Paying for ${payer.name}`}
            </Text>
            {/* amountOutstanding, not totalDue — a payer topping up after a
                partial payment should be charged what's actually left, not
                billed the full amount again. */}
            <Text style={styles.payerSummaryAmount}>₦{payer.amountOutstanding.toLocaleString()}</Text>
            {payer.status === 'underpaid' && (
              <Text style={styles.mutedText}>₦{payer.amountPaid.toLocaleString()} already paid toward ₦{payer.totalDue.toLocaleString()}</Text>
            )}
          </GlassCard>

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
                    // Not just b.code — Paystack's live bank list can list
                    // more than one institution under the same settlement
                    // code (grouped fintech products), so code alone isn't
                    // guaranteed unique. slug is more distinct but the index
                    // is what actually guarantees no collision within this
                    // render regardless of what Paystack returns.
                    keyExtractor={(b, idx) => `${b.code}_${b.slug}_${idx}`}
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

                <PressableScale
                  style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                  onPress={handleSubmitAccount}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryBtnText}>{isSubmitting ? 'Starting…' : 'Continue'}</Text>
                </PressableScale>
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

                <PressableScale
                  style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                  onPress={handleSubmitOtp}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryBtnText}>{isSubmitting ? 'Verifying…' : 'Verify & Pay'}</Text>
                </PressableScale>
              </>
            )}

            {step === 'birthday' && (
              <>
                <Text style={styles.mutedText}>
                  {selectedBank?.name ?? 'Your bank'} needs your date of birth to authorize this payment.
                </Text>
                <View style={{ height: 12 }} />
                <Text style={styles.label}>Date of birth (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2008-09-15"
                  placeholderTextColor={styles.mutedText.color as string}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  value={birthday}
                  onChangeText={(v) => setBirthday(v.replace(/[^0-9-]/g, ''))}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <PressableScale
                  style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
                  onPress={handleSubmitBirthday}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryBtnText}>{isSubmitting ? 'Verifying…' : 'Verify & Pay'}</Text>
                </PressableScale>
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

                <PressableScale style={styles.primaryBtn} onPress={onClose}>
                  <Text style={styles.primaryBtnText}>Done</Text>
                </PressableScale>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
