import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  css: {
    postcss: path.resolve(__dirname, './config/postcss.config.js'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './config'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    reportCompressedSize: false,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // React 核心库
            if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
              return 'react-core';
            }
            // 路由
            if (id.includes('react-router')) {
              return 'react-router';
            }
            // 动画库
            if (id.includes('framer-motion')) {
              return 'animation';
            }
            // Markdown 解析（合并不拆分避免循环引用）
            if (id.includes('react-markdown') || id.includes('unified') || id.includes('mdast') || id.includes('hast') || id.includes('remark-') || id.includes('rehype-')) {
              return 'markdown';
            }
            // 代码高亮
            if (id.includes('highlight.js')) {
              return 'syntax';
            }
            // 数学公式（单独分包，按需加载）
            if (id.includes('katex')) {
              return 'katex';
            }
            // Mermaid 图表 - 单独大包，按需加载
            if (id.includes('mermaid')) {
              return 'mermaid';
            }
            // 图标库 - 按需tree-shake后较小，但仍单独分包
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // DOMPurify
            if (id.includes('dompurify')) {
              return 'dompurify';
            }
            // React Helmet
            if (id.includes('react-helmet') || id.includes('hoist-non-react-statics')) {
              return 'react-helmet';
            }
            // 其他第三方库
            return 'vendor';
          }
        },
        // 资源文件命名（利于缓存）
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        pure_getters: true,
        passes: 2,
        unsafe_proto: true,
      },
    },
  },
  publicDir: 'public',
});
