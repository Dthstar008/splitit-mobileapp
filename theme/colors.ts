// theme/colors.ts
// SplitIt!! brand palette — "Midnight + Electric Emerald": a dark, glowing
// fintech identity (deep near-black surfaces, a vivid emerald accent that
// reads as "money moving," warm gold as the secondary signal color).
// Replaces the earlier soft-gray/emerald-on-white system app-wide — the
// whole app reads as one coherent dark surface now, not a light shell with
// a dark section bolted on (see .agents/skills/design-taste-frontend §4.11,
// "the page has ONE theme").
// NEVER hardcode hex values in screens/components — always pull from useTheme().

export const palette = {
  // Midnight surfaces — each step up is a deliberately visible elevation,
  // not a barely-there tint, so stacked glass cards actually read as
  // layered rather than flat panels with a border.
  midnight900: '#05080B', // true background
  midnight800: '#0C1310', // base surface (cards)
  midnight700: '#141E19', // elevated surface (sheets, modals)
  midnight600: '#1D2922', // further-elevated (active/hover states)
  midnight500: '#28372F', // borders, dividers on dark

  // Electric Emerald — the "money moving" accent. Vivid enough to glow in
  // a shadow, not the muted forest green the old light theme used.
  emeraldGlow: '#2EE6A0', // primary accent
  emeraldGlowDim: '#17C480', // pressed / secondary emphasis
  emeraldDeep: '#0B3B29', // deep fill for text-on-tint contexts
  emeraldTint: 'rgba(46, 230, 160, 0.14)', // translucent surface fill (chips, pills)

  // Gold stays the secondary signal (fees, pending, warnings) — brightened
  // slightly from the old light-theme gold so it still pops on near-black.
  gold: '#FFC93C',
  goldDeep: '#8A6100',
  goldTint: 'rgba(255, 201, 60, 0.16)',

  white: '#FFFFFF',
  textPrimary: '#F2FBF6', // soft white with a whisper of green, not pure #fff
  textMuted: '#8CA69A',
  // Text-ON-the-primary-accent needs to be dark, not white — emeraldGlow is
  // a light, high-luminance green, so white-on-it fails contrast. This is
  // the mandatory BUTTON CONTRAST CHECK from the taste skill, not a style
  // choice: skipping it produces a real WCAG failure on every primary CTA.
  onAccent: '#06120C',

  success: '#33E28D',
  warning: '#FFC93C',
  danger: '#FF6B6B',

  black: '#000000',
  overlay: 'rgba(3, 8, 6, 0.72)',

  // Glass — real depth via expo-blur's BlurView tinted with these, not a
  // flat semi-transparent color standing in for blur.
  glassFill: 'rgba(255, 255, 255, 0.055)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  glassHighlight: 'rgba(255, 255, 255, 0.22)',
  emeraldGlowShadow: 'rgba(46, 230, 160, 0.45)',
} as const;

export type ThemeMode = 'light' | 'dark';

export interface AppTheme {
  mode: ThemeMode;
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    primary: string;
    primaryDark: string;
    primaryLight: string;
    secondary: string;
    secondaryDark: string;
    secondaryLight: string;
    text: string;
    textMuted: string;
    textInverse: string;
    border: string;
    success: string;
    warning: string;
    danger: string;
    overlay: string;
    statusSettled: string;
    statusPending: string;
    tabInactive: string;
    // Glass/glow — new for the Midnight redesign.
    glassFill: string;
    glassBorder: string;
    glassHighlight: string;
    glowShadow: string;
  };
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  font: {
    headingBold: string;
    headingSemiBold: string;
    body: string;
    bodyMedium: string;
    bodySemiBold: string;
    bodyBold: string;
  };
}

export const midnightTheme: AppTheme = {
  mode: 'dark',
  colors: {
    background: palette.midnight900,
    surface: palette.midnight800,
    surfaceAlt: palette.midnight700,
    primary: palette.emeraldGlow,
    primaryDark: palette.emeraldGlowDim,
    primaryLight: palette.emeraldTint,
    secondary: palette.gold,
    secondaryDark: palette.goldDeep,
    secondaryLight: palette.goldTint,
    text: palette.textPrimary,
    textMuted: palette.textMuted,
    textInverse: palette.onAccent,
    border: palette.midnight500,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    overlay: palette.overlay,
    statusSettled: palette.emeraldGlow,
    statusPending: palette.gold,
    tabInactive: '#5C6D64',
    glassFill: palette.glassFill,
    glassBorder: palette.glassBorder,
    glassHighlight: palette.glassHighlight,
    glowShadow: palette.emeraldGlowShadow,
  },
  spacing: (n: number) => n * 4,
  radius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  font: {
    headingBold: 'Sora_700Bold',
    headingSemiBold: 'Sora_600SemiBold',
    body: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
  },
};

// Onboarding used to be a separate pure-white theme; the whole app is one
// dark surface now (taste-skill §4.11 — no section switches theme families
// mid-app), so onboarding is the same Midnight theme with a marginally
// brighter base surface, giving the very first screen a touch more lift
// without breaking theme lock.
export const onboardingTheme: AppTheme = {
  ...midnightTheme,
  colors: {
    ...midnightTheme.colors,
    background: palette.midnight800,
    surface: palette.midnight700,
    surfaceAlt: palette.midnight600,
  },
};

export default midnightTheme;
