import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf7ee',
          100: '#f8ead1',
          500: '#c9973a',
          600: '#a8792a',
          700: '#8a5f22',
        },
      },
    },
  },
  plugins: [],
};

export default config;
