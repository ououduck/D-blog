import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const normalizeBasePath = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return '/';
  }

  if (trimmed === '.' || trimmed === './') {
    return './';
  }

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}/` : '/';
};

const appBase = normalizeBasePath(process.env.VITE_BASE_PATH);

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: appBase,
  esbuild: command === 'build' ? {
    drop: ['console', 'debugger'],
  } : undefined,
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
    cssMinify: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    minify: 'esbuild',
  },
  publicDir: 'public',
}));

