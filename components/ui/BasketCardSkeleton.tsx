// components/ui/BasketCardSkeleton.tsx
// Loading placeholder shaped like the real basket card it's standing in for
// (title bar, meta line, amount), not a generic centered spinner — so the
// list doesn't flash "No active baskets yet" for a beat before data arrives,
// and the layout doesn't jump once it does.

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { createStyles, useTheme } from '../../theme/ThemeContext';

const useStyles = createStyles((theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing(4),
      marginHorizontal: theme.spacing(5),
      marginBottom: theme.spacing(3),
    },
    bar: { height: 14, borderRadius: 7, backgroundColor: theme.colors.surfaceAlt },
  })
);

export default function BasketCardSkeleton() {
  const styles = useStyles();
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.card, { opacity: pulse }]}>
      <View style={[styles.bar, { width: '55%' }]} />
      <View style={[styles.bar, { width: '35%', height: 11, marginTop: theme.spacing(2) }]} />
      <View style={[styles.bar, { width: '30%', marginTop: theme.spacing(3) }]} />
    </Animated.View>
  );
}
