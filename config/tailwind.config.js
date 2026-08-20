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
        // GitHub 风格正文渲染：无衬线标题（粗体 + h1/h2 下边框）、蓝色链接、
        // 灰边引用、等宽行内代码，去除衬线字体与装饰性样式。
        DEFAULT: {
          css: {
            fontFamily: theme('fontFamily.sans').join(', '),
            color: theme('colors.ink'),
            // 移动端 17px 起底；桌面端由 md:prose-lg 提升到 1.125rem。
            fontSize: '1.0625rem',
            lineHeight: '1.9',
            maxWidth: 'none',
            letterSpacing: '0.01em',

            // 颜色变量：GitHub 浅色系（不使用 prose-stone 时兜底）。
            '--tw-prose-body': theme('colors.ink'),
            '--tw-prose-headings': theme('colors.ink'),
            '--tw-prose-lead': '#57606a',
            '--tw-prose-links': '#0969da',
            '--tw-prose-bold': theme('colors.ink'),
            '--tw-prose-counters': '#57606a',
            '--tw-prose-bullets': '#d0d7de',
            '--tw-prose-hr': '#d0d7de',
            '--tw-prose-quotes': '#57606a',
            '--tw-prose-quote-borders': '#d0d7de',
            '--tw-prose-captions': '#57606a',
            '--tw-prose-code': '#1f2328',
            '--tw-prose-pre-code': '#1f2328',
            '--tw-prose-pre-bg': '#f6f8fa',
            '--tw-prose-th-borders': '#d0d7de',
            '--tw-prose-td-borders': '#d0d7de',
            '--tw-prose-kbd': '#1f2328',
            '--tw-prose-kbd-shadows': 'rgba(31,35,40,0.1)',

            // 中文正文两端对齐：消除参差右缘，避免汉字行出现明显空隙。
            'p, li': {
              textAlign: 'justify',
              textJustify: 'inter-ideograph',
            },

            'p + p': { marginTop: '1.5em' },
            'li + li': { marginTop: '0.35em' },
            'ul > li > *:first-child': { marginTop: '0' },
            'ol > li > *:first-child': { marginTop: '0' },

            // GitHub 标题：无衬线粗体，h1/h2 带下边框。
            h1: {
              fontFamily: theme('fontFamily.sans').join(', '),
              fontWeight: '700',
              fontSize: '2em',
              color: theme('colors.ink'),
              marginTop: '0',
              marginBottom: '1em',
              lineHeight: '1.25',
              paddingBottom: '0.3em',
              borderBottom: '1px solid #d0d7de',
              letterSpacing: '-0.01em',
            },
            h2: {
              fontFamily: theme('fontFamily.sans').join(', '),
              fontWeight: '700',
              fontSize: '1.5em',
              color: theme('colors.ink'),
              marginTop: '2em',
              marginBottom: '0.8em',
              letterSpacing: '-0.01em',
              lineHeight: '1.3',
              paddingBottom: '0.3em',
              borderBottom: '1px solid #d0d7de',
            },
            h3: {
              fontFamily: theme('fontFamily.sans').join(', '),
              fontWeight: '600',
              fontSize: '1.25em',
              color: theme('colors.ink'),
              marginTop: '1.75em',
              marginBottom: '0.6em',
              letterSpacing: '-0.005em',
              lineHeight: '1.4',
            },
            h4: {
              fontFamily: theme('fontFamily.sans').join(', '),
              fontWeight: '600',
              fontSize: '1em',
              color: theme('colors.ink'),
              marginTop: '1.5em',
              marginBottom: '0.5em',
              lineHeight: '1.5',
            },
            strong: { color: theme('colors.ink'), fontWeight: '700' },

            // GitHub 引用：无背景、灰左框、弱化文字色。
            blockquote: {
              fontFamily: theme('fontFamily.sans').join(', '),
              fontStyle: 'normal',
              fontWeight: '400',
              color: '#57606a',
              borderLeftColor: '#d0d7de',
              borderLeftWidth: '0.25em',
              backgroundColor: 'transparent',
              padding: '0 1em',
              marginTop: '1.6em',
              marginBottom: '1.6em',
              borderRadius: '0',
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },

            // GitHub 行内代码：等宽、浅底、圆角、无边框。
            code: {
              color: '#1f2328',
              backgroundColor: 'rgba(175,184,193,0.22)',
              padding: '0.2em 0.4em',
              borderRadius: '6px',
              fontWeight: '500',
              fontSize: '0.875em',
              fontFamily: theme('fontFamily.mono').join(', '),
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },

            pre: {
              backgroundColor: '#f6f8fa',
              borderRadius: '6px',
              padding: '1rem 1.1rem',
              border: '1px solid #d0d7de',
              boxShadow: 'none',
              fontSize: '0.9em',
              lineHeight: '1.7',
            },

            // GitHub 链接：蓝色、默认无下划线、悬停显示下划线。
            a: {
              color: '#0969da',
              fontWeight: '500',
              textDecoration: 'none',
            },
            'a:hover': {
              textDecoration: 'underline',
              textDecorationThickness: '2px',
              textUnderlineOffset: '3px',
            },

            img: {
              borderRadius: '6px',
              marginTop: '1.5em',
              marginBottom: '1.5em',
            },

            table: {
              fontSize: '0.875em',
              lineHeight: '1.6',
            },

            hr: {
              borderColor: '#d0d7de',
              marginTop: '2.5em',
              marginBottom: '2.5em',
            },
          },
        },
        invert: {
          css: {
            color: '#e4e4e7',
            lineHeight: '1.9',

            '--tw-prose-body': '#e4e4e7',
            '--tw-prose-headings': '#fafafa',
            '--tw-prose-lead': '#8b949e',
            '--tw-prose-links': '#58a6ff',
            '--tw-prose-bold': '#fafafa',
            '--tw-prose-counters': '#8b949e',
            '--tw-prose-bullets': '#30363d',
            '--tw-prose-hr': '#30363d',
            '--tw-prose-quotes': '#8b949e',
            '--tw-prose-quote-borders': '#30363d',
            '--tw-prose-captions': '#8b949e',
            '--tw-prose-code': '#e6edf3',
            '--tw-prose-pre-code': '#e6edf3',
            '--tw-prose-pre-bg': '#161b22',
            '--tw-prose-th-borders': '#30363d',
            '--tw-prose-td-borders': '#30363d',
            '--tw-prose-kbd': '#e6edf3',
            '--tw-prose-kbd-shadows': 'rgba(230,237,243,0.1)',

            h1: {
              color: '#fafafa',
              borderBottomColor: '#30363d',
            },
            h2: {
              color: '#fafafa',
              borderBottomColor: '#30363d',
            },
            h3: { color: '#fafafa' },
            h4: { color: '#fafafa' },
            strong: { color: '#fafafa', fontWeight: '700' },

            blockquote: {
              color: '#8b949e',
              borderLeftColor: '#30363d',
            },

            code: {
              color: '#e6edf3',
              backgroundColor: 'rgba(110,118,129,0.4)',
            },

            a: {
              color: '#58a6ff',
            },
            'a:hover': {
              textDecorationColor: '#58a6ff',
            },

            hr: {
              borderColor: '#30363d',
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
