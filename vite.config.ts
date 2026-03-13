import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { cloudflareApiMock } from './vite-plugin-cloudflare-mock';

export default defineConfig({
  plugins: [react(), cloudflareApiMock()],
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
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'animation': ['framer-motion'],
          'markdown': ['react-markdown', 'remark-gfm', 'rehype-highlight'],
          'highlight': ['highlight.js'],
        },
      },
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild',
  },
  publicDir: 'public',
});
