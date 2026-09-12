// components/ui/PressableScale.tsx
// Shared tactile-press feedback: a physical -2% scale "push" on touch-down,
// spring back on release. One implementation shared by every primary CTA
// instead of six copies of the same Animated.spring boilerplate.
//
// Uses core RN Animated (not Reanimated) — deliberately: this app doesn't
// depend on Reanimated anywhere else, and a plain Animated.spring on a
// single scale value has no worklet/babel-plugin setup to get wrong.
//
// Animates the Pressable itself (via Animated.createAnimatedComponent)
// rather than wrapping it in an extra View. A wrapping View here would
// collapse to zero size around any child styled with `position: absolute`
// (the Home FAB) or `flex: 1/2` inside a row (Add Payers' Back/Finalize
// split) — the transform has to live on the same element the caller's
// layout styles are already on.

import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

export default function PressableScale({ style, scaleTo = 0.97, disabled, ...props }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) animateTo(scaleTo);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) animateTo(1);
        props.onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}
