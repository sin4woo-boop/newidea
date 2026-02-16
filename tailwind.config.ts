import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(220 14% 90%)',
        input: 'hsl(220 14% 90%)',
        ring: 'hsl(220 14% 40%)',
        background: 'hsl(220 20% 99%)',
        foreground: 'hsl(220 20% 12%)',
        primary: {
          DEFAULT: 'hsl(220 36% 20%)',
          foreground: 'hsl(0 0% 100%)'
        },
        muted: {
          DEFAULT: 'hsl(220 16% 94%)',
          foreground: 'hsl(220 10% 40%)'
        },
        card: {
          DEFAULT: 'hsl(0 0% 100%)',
          foreground: 'hsl(220 20% 12%)'
        }
      },
      borderRadius: {
        lg: '0.8rem',
        md: '0.6rem',
        sm: '0.4rem'
      }
    }
  },
  plugins: []
};

export default config;
