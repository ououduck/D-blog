import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '"PingFang SC"', 
          '"Microsoft YaHei"', 
          'ui-sans-serif', 
          'system-ui', 
          '-apple-system', 
          'BlinkMacSystemFont', 
          '"Segoe UI"', 
          'Roboto', 
          '"Helvetica Neue"', 
          'Arial', 
          '"Noto Sans"', 
          'sans-serif', 
          '"Apple Color Emoji"', 
          '"Segoe UI Emoji"', 
          '"Segoe UI Symbol"', 
          '"Noto Color Emoji"'
        ],
        serif: [
          '"Playfair Display"', 
          '"Noto Serif SC"', 
          '"Songti SC"', 
          '"SimSun"', 
          '"Times New Roman"', 
          'Times', 
          'serif'
        ],
        mono: [
          '"JetBrains Mono"', 
          '"Fira Code"', 
          'ui-monospace', 
          'SFMono-Regular', 
          'Menlo', 
          'Monaco', 
          'Consolas', 
          '"Liberation Mono"', 
          '"Courier New"', 
          'monospace'
        ],
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
            fontFamily: theme('fontFamily.sans').join(', '),
            color: theme('colors.ink'),
            fontSize: '1.125rem', // 18px
            lineHeight: '1.8',
            maxWidth: 'none', // 取消最大宽度限制，由容器控制
            
            h1: { 
              fontFamily: theme('fontFamily.serif').join(', '), 
              fontWeight: '800',
              color: theme('colors.ink'),
            },
            h2: { 
              fontFamily: theme('fontFamily.serif').join(', '), 
              fontWeight: '700',
              color: theme('colors.ink'),
              marginTop: '2em',
            },
            h3: { 
              fontFamily: theme('fontFamily.serif').join(', '), 
              fontWeight: '600',
              color: theme('colors.ink'),
            },
            h4: { 
              fontFamily: theme('fontFamily.serif').join(', '), 
              color: theme('colors.ink'),
            },
            strong: { color: theme('colors.accent.DEFAULT') },
            
            // 优化代码块
            code: {
              color: theme('colors.accent.DEFAULT'),
              backgroundColor: 'rgba(0,0,0,0.05)',
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
              fontWeight: '600',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            
            blockquote: {
              fontFamily: theme('fontFamily.serif').join(', '),
              borderLeftColor: theme('colors.accent.DEFAULT'),
            },
          },
        },
        invert: {
          css: {
            color: '#e5e5e5',
            h1: { color: '#e5e5e5' },
            h2: { color: '#e5e5e5' },
            h3: { color: '#e5e5e5' },
            h4: { color: '#e5e5e5' },
            strong: { color: theme('colors.accent.light') },
            code: {
              color: theme('colors.accent.light'),
              backgroundColor: 'rgba(255,255,255,0.1)',
            },
          }
        }
      }),
    }
  },
  plugins: [
    typography,
  ],
}
