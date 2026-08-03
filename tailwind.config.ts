import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff', 100: '#d9e8ff', 200: '#bcd6ff', 300: '#8ebbff',
          400: '#5893ff', 500: '#316bff', 600: '#1a4bf5', 700: '#1539e1',
          800: '#1830b6', 900: '#1a2f8f', 950: '#151d54',
        },
      },
      typography: {},
    },
  },
  plugins: [],
};
export default config;
