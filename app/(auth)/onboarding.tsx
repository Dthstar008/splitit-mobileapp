// app/(auth)/onboarding.tsx
// 3-step swiper: bulk-food splitting, QR bill scanning, virtual account routing.

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Dimensions,
  FlatList,
  StyleSheet,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ShoppingBasket, ScanLine, Landmark } from 'lucide-react-native';
import { useOnboardingTheme, createStyles } from '../../theme/ThemeContext';
import PressableScale from '../../components/ui/PressableScale';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    key: 'basket',
    Icon: ShoppingBasket,
    title: 'Split the food money, not the friendship',
    body: 'Bulk-buy foodstuff with your people and let SplitIt!! divide the cost fairly, down to the last naira.',
  },
  {
    key: 'qr',
    Icon: ScanLine,
    title: 'Scan a bill, settle in seconds',
    body: 'Every basket gets a QR code and a text code. Scan or type it in to pull up exactly what you owe.',
  },
  {
    key: 'bank',
    Icon: Landmark,
    title: 'Instant virtual account, every time',
    body: "Pay straight into an auto-generated bank account tied to your basket. No transfers to the wrong person.",
  },
];

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: theme.colors.background },
    slide: {
      width,
      paddingHorizontal: theme.spacing(8),
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrap: {
      width: 120,
      height: 120,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing(8),
    },
    accentDot: {
      position: 'absolute',
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.secondary,
      top: -8,
      right: -8,
    },
    title: {
      fontSize: 24,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing(3),
      fontFamily: theme.font.headingBold,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textMuted,
      textAlign: 'center',
      fontFamily: theme.font.body,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingBottom: theme.spacing(4),
      marginTop: theme.spacing(6),
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
    },
    dotActive: {
      backgroundColor: theme.colors.primary,
      width: 22,
    },
    footer: {
      paddingHorizontal: theme.spacing(6),
      paddingBottom: theme.spacing(6),
      gap: theme.spacing(3),
    },
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      paddingVertical: theme.spacing(4),
      alignItems: 'center',
    },
    primaryBtnText: {
      color: theme.colors.textInverse,
      fontSize: 16,
      fontFamily: theme.font.bodyBold,
    },
    skipBtn: { alignItems: 'center', paddingVertical: theme.spacing(2) },
    skipBtnText: { color: theme.colors.textMuted, fontFamily: theme.font.bodySemiBold },
  })
);

export default function OnboardingScreen() {
  const theme = useOnboardingTheme();
  const styles = useStyles();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
    } else {
      router.push('/(auth)/signup');
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => {
          const { Icon } = item;
          return (
            <View style={styles.slide}>
              <View style={styles.iconWrap}>
                <Icon size={48} color={theme.colors.primary} />
                <View style={styles.accentDot} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          );
        }}
      />

      <View style={styles.dotsRow}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <PressableScale style={styles.primaryBtn} onPress={goNext}>
          <Text style={styles.primaryBtnText}>
            {index === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </PressableScale>
        {index < SLIDES.length - 1 && (
          <Pressable style={styles.skipBtn} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
