import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary brand — warm orange from the mockups.
        brand: {
          50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
          400: '#fb923c', 500: '#f6851f', 600: '#ea6a0e', 700: '#c2540b',
          800: '#9a4310', 900: '#7c3810', 950: '#431c07',
        },
        // Dark slate / ink used for the header bar and dark surfaces.
        ink: {
          50: '#f5f6f8', 100: '#e9ebf0', 200: '#cfd4de', 300: '#a7b0c0',
          400: '#78859c', 500: '#586780', 600: '#455168', 700: '#394254',
          800: '#2b3240', 900: '#1f2530', 950: '#141821',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,20,28,.04), 0 4px 12px rgba(16,20,28,.06)',
        'card-hover': '0 2px 4px rgba(16,20,28,.06), 0 12px 28px rgba(16,20,28,.12)',
        modal: '0 24px 64px rgba(16,20,28,.28)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'translateY(8px) scale(.99)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'scale-in': 'scale-in .2s cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
};
export default config;
