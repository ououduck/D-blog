import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const appBase = process.env.VITE_BASE_PATH?.trim() || './';

const SKIP_MODULE_PRELOAD_PATTERNS = [
  /(?:^|\/)assets\/(?:mermaid|katex|markdown|syntax|dompurify)-/,
  /(?:^|\/)assets\/Post-/,
  /(?:^|\/)assets\/CoverGenerator-/,
];

const LARGE_VENDOR_LIBS: Array<[string, string]> = [
  ['@remix-run/router', 'router-core'],
  ['decode-named-character-reference', 'markdown'],
  ['character-entities', 'markdown'],
  ['property-information', 'markdown'],
  ['hast-util', 'markdown'],
  ['mdast-util', 'markdown'],
  ['micromark', 'markdown'],
  ['remark-', 'markdown'],
  ['rehype-', 'markdown'],
  ['unified', 'markdown'],
  ['bail', 'markdown'],
  ['trough', 'markdown'],
  ['unist-', 'markdown'],
  ['vfile', 'markdown'],
  ['comma-separated-tokens', 'markdown'],
  ['space-separated-tokens', 'markdown'],
  ['web-namespaces', 'markdown']
];


const resolveVendorChunk = (id: string) => {
  for (const [pattern, chunkName] of LARGE_VENDOR_LIBS) {
    if (id.includes(pattern)) {
      return chunkName;
    }
  }

  return 'vendor';
};

export default defineConfig({
  plugins: [react()],
  base: appBase,
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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
              return 'react-core';
            }
            if (id.includes('react-router')) {
              return 'react-router';
            }
            if (id.includes('framer-motion')) {
              return 'animation';
            }
            if (id.includes('react-markdown') || id.includes('remark-') || id.includes('rehype-')) {
              return 'markdown';
            }
            if (id.includes('highlight.js')) {
              return 'syntax';
            }
            if (id.includes('katex')) {
              return 'katex';
            }
            if (id.includes('mermaid')) {
              return 'mermaid';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('dompurify')) {
              return 'dompurify';
            }
            if (id.includes('react-helmet') || id.includes('hoist-non-react-statics')) {
              return 'react-helmet';
            }

            return resolveVendorChunk(id);
          }
        },
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

