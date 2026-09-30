const STORAGE_KEY = 'leadryze-theme';
export type Theme = 'light' | 'dark';

/** Saved preference, else system preference. Read-only — never writes. */
export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* localStorage unavailable (private mode, etc.) — fall through */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the theme to <html> (Tailwind's darkMode:'class' strategy) and
 * persists it. Called as early as possible in main.tsx to minimize the
 * flash of the wrong theme on load — this app's CSP (script-src 'self',
 * no 'unsafe-inline') rules out the usual inline-<script>-in-<head>
 * trick, so a brief flash before this module executes is an accepted,
 * unavoidable tradeoff rather than something to fix by weakening the CSP. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}
