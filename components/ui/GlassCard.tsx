// components/ui/GlassCard.tsx
// Real depth via expo-blur's native BlurView — not a flat semi-transparent
// View standing in for glass. One shared implementation for every card in
// the Midnight redesign (basket cards, the QR card, search results) so the
// glass treatment is identical everywhere instead of six approximations.
//
// `glow` swaps the shadow to a tinted emerald glow for the one or two real
// "money moment" surfaces per screen (the QR card, a settled basket) —
// used sparingly on purpose. Every other card gets the plain dark shadow;
// if everything glows, nothing does.

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../theme/ThemeContext';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
  radius?: number;
}

export default function GlassCard({ children, style, glow = false, radius }: GlassCardProps) {
  const theme = useTheme();
  const borderRadius = radius ?? theme.radius.lg;

  return (
    <View
      style={[
        {
          borderRadius,
          borderWidth: 1,
          borderColor: theme.colors.glassBorder,
          overflow: 'hidden',
          shadowOffset: { width: 0, height: glow ? 10 : 6 },
          shadowRadius: glow ? 24 : 14,
          shadowOpacity: glow ? 0.55 : 0.4,
          shadowColor: glow ? theme.colors.glowShadow : '#000',
          elevation: glow ? 14 : 6,
        },
        style,
      ]}
    >
      {/* Android has no native BlurView backdrop-filter equivalent this
          cheap — expo-blur falls back to a flat tint there, which still
          reads as "dark glass surface," just without the live blur. */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 100}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.glassFill, borderRadius }]} />
      {children}
    </View>
  );
}
