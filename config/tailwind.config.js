import typography from '@tailwindcss/typography';

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
            fontSize: '1.125rem',
            lineHeight: '1.85',
            maxWidth: 'none',
            letterSpacing: '0.005em',
            
            'p + p': { marginTop: '1.4em' },
            'li + li': { marginTop: '0.35em' },
            'ul > li > *:first-child': { marginTop: '0' },
            'ol > li > *:first-child': { marginTop: '0' },
            
            h1: { 
              fontFamily: theme('fontFamily.serif').join(', '), 
              fontWeight: '800',
              color: theme('colors.ink'),
              letterSpacing: '-0.015em',
            },
            h2: { 
              fontFamily: theme('fontFamily.serif').join(', '), 
              fontWeight: '700',
              color: theme('colors.ink'),
              marginTop: '2.2em',
              marginBottom: '0.7em',
              letterSpacing: '-0.01em',
              lineHeight: '1.3',
              paddingBottom: '0.35em',
              borderBottom: '1px solid #e5e7eb',
            },
            h3: { 
              fontFamily: theme('fontFamily.serif').join(', '), 
              fontWeight: '600',
              color: theme('colors.ink'),
              marginTop: '1.8em',
              marginBottom: '0.6em',
              letterSpacing: '-0.005em',
              lineHeight: '1.35',
            },
            h4: { 
              fontFamily: theme('fontFamily.serif').join(', '), 
              fontWeight: '600',
              color: theme('colors.ink'),
              marginTop: '1.5em',
              marginBottom: '0.5em',
              lineHeight: '1.4',
            },
            strong: { color: theme('colors.ink'), fontWeight: '700' },
            
            blockquote: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontStyle: 'normal',
              borderLeftColor: theme('colors.accent.DEFAULT'),
              borderLeftWidth: '4px',
              backgroundColor: 'rgba(192,57,43,0.03)',
              padding: '1.4em 1.8em',
              marginTop: '1.8em',
              marginBottom: '1.8em',
              borderRadius: '0 0.75rem 0.75rem 0',
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            
            code: {
              color: theme('colors.accent.DEFAULT'),
              backgroundColor: 'rgba(192,57,43,0.06)',
              padding: '0.15em 0.45em',
              borderRadius: '0.3rem',
              fontWeight: '600',
              fontSize: '0.875em',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            
            pre: {
              backgroundColor: '#0d1117',
              borderRadius: '0.75rem',
              padding: '0',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            },
            
            a: {
              color: theme('colors.ink'),
              fontWeight: '600',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(28,25,23,0.2)',
              textUnderlineOffset: '2px',
              textDecorationThickness: '2px',
              transition: 'text-decoration-color 0.2s ease, text-underline-offset 0.2s ease',
            },
            'a:hover': {
              textDecorationColor: theme('colors.ink'),
              textUnderlineOffset: '4px',
            },
            
            img: {
              borderRadius: '0.75rem',
              marginTop: '2em',
              marginBottom: '2em',
            },
            
            table: {
              fontSize: '0.875em',
              lineHeight: '1.6',
            },
            
            hr: {
              borderColor: '#e5e7eb',
              marginTop: '2.5em',
              marginBottom: '2.5em',
            },
          },
        },
        invert: {
          css: {
            color: '#d4d4d8',
            lineHeight: '1.85',
            
            h1: { color: '#fafafa' },
            h2: { 
              color: '#fafafa',
              borderBottomColor: '#27272a',
            },
            h3: { color: '#fafafa' },
            h4: { color: '#fafafa' },
            strong: { color: '#fafafa', fontWeight: '700' },
            
            blockquote: {
              borderLeftColor: theme('colors.accent.light'),
              backgroundColor: 'rgba(231,76,60,0.06)',
              color: '#e4e4e7',
            },
            
            code: {
              color: theme('colors.accent.light'),
              backgroundColor: 'rgba(231,76,60,0.12)',
            },
            
            a: {
              color: '#fafafa',
              textDecorationColor: 'rgba(250,250,250,0.2)',
            },
            'a:hover': {
              textDecorationColor: '#fafafa',
            },
            
            hr: {
              borderColor: '#3f3f46',
            },
            
            img: {
              boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
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
