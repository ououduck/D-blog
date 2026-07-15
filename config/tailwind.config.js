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
        // Keep legacy accent utilities working while making them fully neutral.
        accent: {
          DEFAULT: '#3f3f46',
          light: '#d4d4d8',
          dark: '#18181b'
        }
      },
      borderRadius: {
        micro: '4px',
        control: '6px',
        icon: '8px',
        surface: '8px',
        overlay: '12px',
        media: '8px',
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
              backgroundColor: 'rgba(63,63,70,0.04)',
              padding: '1.4em 1.8em',
              marginTop: '1.8em',
              marginBottom: '1.8em',
              borderRadius: '0',
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            
            code: {
              color: theme('colors.ink'),
              backgroundColor: 'rgba(63,63,70,0.08)',
              padding: '0.15em 0.45em',
              borderRadius: '0',
              fontWeight: '600',
              fontSize: '0.875em',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            
            pre: {
              backgroundColor: '#0d0d0f',
              borderRadius: '0',
              padding: '0',
              border: '1px solid rgba(63,63,70,0.8)',
              boxShadow: 'none',
            },
            
            a: {
              color: theme('colors.ink'),
              fontWeight: '600',
              textDecoration: 'underline',
              textDecorationColor: 'rgba(28,25,23,0.28)',
              textUnderlineOffset: '3px',
              textDecorationThickness: '2px',
            },
            'a:hover': {
              textDecorationColor: theme('colors.ink'),
            },
            
            img: {
              borderRadius: theme('borderRadius.media'),
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
              backgroundColor: 'rgba(212,212,216,0.06)',
              color: '#e4e4e7',
            },
            
            code: {
              color: '#f4f4f5',
              backgroundColor: 'rgba(212,212,216,0.1)',
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
              boxShadow: 'none',
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
