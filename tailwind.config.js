/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
      colors: {
        paper: '#f2f0e9',
        ink: '#1c1917',
        void: '#0a0a0a',
        accent: {
          DEFAULT: '#c0392b',
          light: '#e74c3c',
          dark: '#922b21'
        }
      },
      animation: {
        'float': 'float 12s ease-in-out infinite',
        'grain': 'grain 8s steps(10) infinite',
        'shimmer': 'shimmer 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0)' },
          '50%': { transform: 'translateY(-30px) rotate(1deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-2%, -5%)' },
          '20%': { transform: 'translate(-8%, 2%)' },
          '30%': { transform: 'translate(4%, -10%)' },
          '40%': { transform: 'translate(-2%, 8%)' },
          '50%': { transform: 'translate(-8%, 4%)' },
          '60%': { transform: 'translate(6%, 0%)' },
          '70%': { transform: 'translate(0%, 6%)' },
          '80%': { transform: 'translate(2%, 12%)' },
          '90%': { transform: 'translate(-4%, 4%)' },
        }
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            color: theme('colors.ink'),
            h1: { fontFamily: '"Playfair Display", serif', fontWeight: '800' },
            h2: { fontFamily: '"Playfair Display", serif', fontWeight: '700' },
            h3: { fontFamily: '"Playfair Display", serif', fontWeight: '600' },
            strong: { color: theme('colors.accent.DEFAULT') },
          },
        },
        invert: {
          css: {
            color: '#e5e5e5',
            strong: { color: theme('colors.accent.light') },
          }
        }
      }),
    }
  },
  plugins: [
    // require('@tailwindcss/typography'), // 暂时注释掉，避免构建问题
  ],
}