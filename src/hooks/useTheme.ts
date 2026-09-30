import { useCallback, useState } from 'react';
import { applyTheme, getInitialTheme, type Theme } from '../utils/theme';

/** Real light/dark toggle, backed by utils/theme.ts. main.tsx already
 * applies the initial theme synchronously before React mounts (to
 * minimize flash) — this hook's useState initializer reads the same
 * getInitialTheme() so it starts in sync with whatever's already on
 * <html>, then owns all subsequent changes. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
