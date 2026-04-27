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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // React 核心库
            if (id.includes('react') || id.includes('react-dom')) {
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
            // Markdown 相关
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype')) {
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
      },
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 500,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log'],
      },
    },
  },
  publicDir: 'public',
});
