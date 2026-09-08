// theme/colors.ts
// SplitIt!! brand palette — Emerald/Forest Green + Golden Yellow fintech system.
// NEVER hardcode hex values in screens/components — always pull from useTheme().

export const palette = {
  // Core brand
  emerald50: '#E9F7EF',
  emerald100: '#C6ECD6',
  emerald300: '#4FBE83',
  emerald500: '#0F7A45', // primary brand green
  emerald600: '#0B6137',
  emerald700: '#084B2A',
  emerald900: '#052E1A',

  gold100: '#FDF3D6',
  gold300: '#F6D667',
  gold500: '#F0B90B', // primary brand gold
  gold600: '#D19E00',
  gold700: '#9C7500',

  white: '#FFFFFF',
  softGray50: '#F7F8F9',
  softGray100: '#EEF1F0',
  softGray200: '#E2E6E4',
  softGray400: '#A7B0AC',
  softGray600: '#6B7570',
  charcoal900: '#12211A',

  success: '#1F9D55',
  warning: '#F0B90B',
  danger: '#E03B3B',

  black: '#000000',
  overlay: 'rgba(5, 46, 26, 0.45)',
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
  };
  spacing: (n: number) => number;
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  font: {
    heading: string;
    body: string;
  };
}

// Onboarding uses a distinct crisp-white, high-contrast look; dashboard uses
// the soft-gray fintech base. Both are exposed here so screens can opt in.
export const lightTheme: AppTheme = {
  mode: 'light',
  colors: {
    background: palette.softGray50,
    surface: palette.white,
    surfaceAlt: palette.softGray100,
    primary: palette.emerald500,
    primaryDark: palette.emerald700,
    primaryLight: palette.emerald100,
    secondary: palette.gold500,
    secondaryDark: palette.gold700,
    secondaryLight: palette.gold100,
    text: palette.charcoal900,
    textMuted: palette.softGray600,
    textInverse: palette.white,
    border: palette.softGray200,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    overlay: palette.overlay,
    statusSettled: palette.emerald500,
    statusPending: palette.gold500,
    tabInactive: palette.softGray400,
  },
  spacing: (n: number) => n * 4,
  radius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  font: {
    heading: 'System',
    body: 'System',
  },
};

// Onboarding-specific overlay theme: pure white bg, bolder brand pops.
export const onboardingTheme: AppTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    background: palette.white,
    surface: palette.white,
    surfaceAlt: palette.emerald50,
  },
};

export default lightTheme;
