// theme/ThemeContext.tsx
// Same pattern as Hagah: useTheme() + createStyles(theme) factory.
// Swap `lightTheme` for a dark variant here later if SplitIt!! ever needs
// a dark dashboard mode — screens never need to change.

import React, { createContext, useContext, useMemo } from 'react';
import { AppTheme, lightTheme, onboardingTheme } from './colors';

interface ThemeContextValue {
  theme: AppTheme;
  onboardingTheme: AppTheme;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  onboardingTheme,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo(() => ({ theme: lightTheme, onboardingTheme }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): AppTheme {
  return useContext(ThemeContext).theme;
}

export function useOnboardingTheme(): AppTheme {
  return useContext(ThemeContext).onboardingTheme;
}

// createStyles: pass a function that receives the theme, get back a hook.
// Usage:
//   const useStyles = createStyles((theme) => StyleSheet.create({ ... }));
//   const styles = useStyles();
export function createStyles<T>(factory: (theme: AppTheme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => factory(theme), [theme]);
  };
}
