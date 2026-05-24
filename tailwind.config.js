/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        splat: ['"M PLUS Rounded 1c"', 'sans-serif'],
      },
      colors: {
        // Option A: ワイヤレス充電
        cyan: {
          splat: '#00C4EE',
          dark: '#006A8A',
          light: '#B3EEFF',
        },
        // Option B: 電子レンジ
        orange: {
          splat: '#FF6B35',
          dark: '#B03A10',
          light: '#FFD4C2',
        },
        ink: {
          dark: '#1A1A2E',
          mid: '#16213E',
          light: '#0F3460',
        },
      },
      keyframes: {
        'splat-in': {
          '0%': { transform: 'scale(0) rotate(-20deg)', opacity: '0' },
          '70%': { transform: 'scale(1.15) rotate(5deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        'ink-drop': {
          '0%': { transform: 'scale(0)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
      },
      animation: {
        'splat-in': 'splat-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'float': 'float 3s ease-in-out infinite',
        'shake': 'shake 0.3s ease-in-out',
        'ink-drop': 'ink-drop 1s ease-out forwards',
      },
    },
  },
  plugins: [],
}
