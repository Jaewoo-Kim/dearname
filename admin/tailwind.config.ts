import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf7ee',
          100: '#f8ead1',
          200: '#f0d9ab',
          300: '#e5c17d',
          400: '#d9ab54',
          500: '#c9973a',
          600: '#a8792a',
          700: '#8a5f22',
          800: '#6f4c1c',
          900: '#5a3e18',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 8px -2px rgb(15 23 42 / 0.06)',
        popover: '0 12px 32px -8px rgb(15 23 42 / 0.18)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
