import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import colors from 'tailwindcss/colors';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
        'fade-in-up': 'fade-in-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        }
      },
      colors: {
        brand: {
          ...colors.indigo,
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        secondary: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
        },
        accent: {
          500: '#06B6D4',
        },
        dark: {
          700: '#0D1328',
          800: '#081223',
          900: '#050816',
        },
        // LeadRyze design-system tokens (additive — see index.css for the
        // underlying CSS custom properties and DESIGN-SYSTEM.md for usage
        // rules). Theme-aware via rgb(var(--x) / <alpha-value>): resolves
        // to the light or dark value automatically depending on whether
        // .dark is set on <html>, with no dark: variant needed at the
        // point of use. `ryze` is the new InnooRyze-teal brand scale,
        // named separately from the existing `brand` (still stock indigo,
        // untouched) to avoid colliding with it before the old token is
        // migrated in a later pass.
        background:      'rgb(var(--color-background) / <alpha-value>)',
        surface:         'rgb(var(--color-surface) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        'text-primary':  'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-muted':    'rgb(var(--color-text-muted) / <alpha-value>)',
        border:          'rgb(var(--color-border) / <alpha-value>)',
        ryze: {
          50:  'rgb(var(--color-ryze-50) / <alpha-value>)',
          100: 'rgb(var(--color-ryze-100) / <alpha-value>)',
          200: 'rgb(var(--color-ryze-200) / <alpha-value>)',
          300: 'rgb(var(--color-ryze-300) / <alpha-value>)',
          400: 'rgb(var(--color-ryze-400) / <alpha-value>)',
          500: 'rgb(var(--color-ryze-500) / <alpha-value>)',
          600: 'rgb(var(--color-ryze-600) / <alpha-value>)',
          700: 'rgb(var(--color-ryze-700) / <alpha-value>)',
          800: 'rgb(var(--color-ryze-800) / <alpha-value>)',
          900: 'rgb(var(--color-ryze-900) / <alpha-value>)',
        },
        success: {
          500: 'rgb(var(--color-success-500) / <alpha-value>)',
          600: 'rgb(var(--color-success-600) / <alpha-value>)',
          700: 'rgb(var(--color-success-700) / <alpha-value>)',
        },
        danger: {
          500: 'rgb(var(--color-danger-500) / <alpha-value>)',
          600: 'rgb(var(--color-danger-600) / <alpha-value>)',
          700: 'rgb(var(--color-danger-700) / <alpha-value>)',
        },
        sidebar: {
          bg:     'rgb(var(--color-sidebar-bg) / <alpha-value>)',
          text:   'rgb(var(--color-sidebar-text) / <alpha-value>)',
          muted:  'rgb(var(--color-sidebar-text-muted) / <alpha-value>)',
          border: 'rgb(var(--color-sidebar-border) / <alpha-value>)',
          accent: 'rgb(var(--color-sidebar-accent) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        // Display face — reserved for the login/marketing surface's brand
        // wordmark and hero headline only; every other screen stays on
        // Inter (`font-sans`), unchanged.
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        // Handwritten accent — the small cursive callout tagline next to
        // the hero headline only. Nowhere else.
        script: ['Caveat', 'cursive'],
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
    },
  },
  plugins: [
    forms,
    typography,
  ],
} satisfies Config;
