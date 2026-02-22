import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 设置为 './' 可以确保在 Cloudflare Pages 等环境下，
  // 无论部署在根目录还是子目录，资源路径都能正确加载。
  base: './', 
  resolve: {
    alias: {
      // 保持与 tsconfig.json 一致的路径别名
      '@': path.resolve(__dirname, './'),
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    // 确保输出目录为 dist
    outDir: 'dist',
    // 生产环境移除 sourcemap 以减小体积
    sourcemap: false,
    // 优化 CSS 输出
    cssMinify: true,
    rollupOptions: {
      output: {
        // 确保 CSS 文件在根目录，便于 HTML 引用
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return '[name].[hash].css'; // 放在根目录
          }
          return 'assets/[name].[hash].[ext]';
        },
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js'
      }
    }
  },
});
