import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // 中文阅读优先系统最优无衬线：Windows 微软雅黑、macOS 苹方；
        // 其次常见国产黑体（鸿蒙/小米/阿里巴巴普惠体）与思源黑体，
        // 避免 Linux/Android 落到低质量的通用 sans-serif。
        sans: [
          '"Microsoft YaHei"',
          '"PingFang SC"',
          '"HarmonyOS Sans SC"',
          '"MiSans"',
          '"Alibaba PuHuiTi"',
          '"Noto Sans SC"',
          '"Source Han Sans SC"',
          '"Noto Sans CJK SC"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Plus Jakarta Sans"',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
        // 衬线标题：拉丁字符用 Playfair Display（已随站点加载），中文回退链
        // 优先思源宋体/华文宋体；Windows 无宋体系字体时回退微软雅黑（比 SimSun
        // 在大字号下更清晰），SimSun 仅作最后兜底。
        serif: [
          '"Playfair Display"',
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Source Han Serif CN"',
          '"Songti SC"',
          '"STSong"',
          '"Microsoft YaHei"',
          '"SimSun"',
          '"Times New Roman"',
          'Times',
          'serif',
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
          'monospace',
        ],
      },
      colors: {
        paper: '#f2f0e9',
        ink: '#1c1917',
        void: '#0a0a0a',
        // 保留旧版 accent 工具类可用，同时将其完全中性化（不再绑定品牌主题色）。
        accent: {
          DEFAULT: '#3f3f46',
          light: '#d4d4d8',
          dark: '#18181b',
        },
      },
      borderRadius: {
        micro: '4px',
        control: '6px',
        icon: '8px',
        surface: '8px',
        overlay: '12px',
        media: '8px',
      },
      zIndex: {
        floating: '40',
        nav: '50',
        'nav-panel': '85',
        popover: '70',
        modal: '100',
        nested: '110',
        viewer: '120',
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            fontFamily: theme('fontFamily.sans').join(', '),
            color: theme('colors.ink'),
            // 移动端 17px 起底；桌面端由 md:prose-lg 提升到 1.125rem。
            fontSize: '1.0625rem',
            lineHeight: '1.9',
            maxWidth: 'none',
            letterSpacing: '0.01em',

            // 中文正文两端对齐：消除参差右缘，避免汉字行出现明显空隙。
            'p, li': {
              textAlign: 'justify',
              textJustify: 'inter-ideograph',
            },

            'p + p': { marginTop: '1.6em' },
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
              marginTop: '2.5em',
              marginBottom: '0.8em',
              letterSpacing: '-0.01em',
              lineHeight: '1.35',
              paddingBottom: '0.35em',
              borderBottom: '1px solid #e7e5e4',
            },
            h3: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontWeight: '600',
              color: theme('colors.ink'),
              marginTop: '2em',
              marginBottom: '0.7em',
              letterSpacing: '-0.005em',
              lineHeight: '1.4',
            },
            h4: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontWeight: '600',
              color: theme('colors.ink'),
              marginTop: '1.6em',
              marginBottom: '0.6em',
              lineHeight: '1.45',
            },
            strong: { color: theme('colors.ink'), fontWeight: '700' },

            blockquote: {
              fontFamily: theme('fontFamily.serif').join(', '),
              fontStyle: 'normal',
              borderLeftColor: theme('colors.accent.DEFAULT'),
              borderLeftWidth: '4px',
              backgroundColor: 'rgba(63,63,70,0.04)',
              padding: '1.3em 1.7em',
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
              // 行内代码统一等宽字体：与正文黑体明显区分，代码更易扫读。
              fontFamily: theme('fontFamily.mono').join(', '),
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
              borderColor: '#e7e5e4',
              marginTop: '2.5em',
              marginBottom: '2.5em',
            },
          },
        },
        invert: {
          css: {
            color: '#e4e4e7',
            lineHeight: '1.9',

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
          },
        },
      }),
    },
  },
  plugins: [typography],
};
