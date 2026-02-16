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
        border: '#E9E1D3',
        input: '#E9E1D3',
        ring: '#B89A5D',
        background: '#F7F4EE',
        foreground: '#171717',
        primary: {
          DEFAULT: '#B89A5D',
          foreground: '#ffffff'
        },
        muted: {
          DEFAULT: '#F1ECE3',
          foreground: '#737373'
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#171717'
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
