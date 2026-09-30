import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

// Shares utils/theme.ts's getInitialTheme/applyTheme (same localStorage key,
// same <html>.dark toggle) with the Header's theme toggle — this component
// previously had its own separate isDark state under a different
// localStorage key ('theme' vs 'leadryze-theme'), which meant toggling
// here (on the auth pages this is mounted on) silently didn't persist
// into the post-login app, and vice versa, since both wrote the same
// <html> class independently. Now there's exactly one source of truth.
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="p-2.5 rounded-full bg-white/10 dark:bg-black/20 backdrop-blur-md border border-gray-200/50 dark:border-white/10 shadow-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </motion.button>
  );
}
