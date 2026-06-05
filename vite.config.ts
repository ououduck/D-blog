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
            // 代码高亮和数学公式
            if (id.includes('highlight.js') || id.includes('katex')) {
              return 'syntax';
            }
            // Mermaid 图表
            if (id.includes('mermaid')) {
              return 'mermaid';
            }
            // 图标库
            if (id.includes('lucide-react')) {
              return 'icons';
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
    chunkSizeWarningLimit: 500,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        pure_getters: true,
        passes: 2,
      },
    },
  },
  publicDir: 'public',
});
