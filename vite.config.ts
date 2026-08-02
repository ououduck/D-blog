import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * 文章配图已迁移至 posts/posts-img/（与 Markdown 内容同目录，便于 Obsidian 管理）。
 * 该插件保持 /posts-img/* 的公开访问路径不变：
 * - 开发服务器：将 /posts-img/* 请求转发到 posts/posts-img/*
 * - 生产构建：构建完成后把 posts/posts-img/* 拷贝到 dist/posts-img/*
 */
const POSTS_IMG_SOURCE_DIR = path.resolve(__dirname, './posts/posts-img');
const POSTS_IMG_URL_PREFIX = '/posts-img';

const POSTS_IMG_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
};

const postsImgPublicPlugin = (): Plugin => {
  let outDir = 'dist';

  return {
    name: 'posts-img-public-mapping',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || '';
        if (!url.startsWith(`${POSTS_IMG_URL_PREFIX}/`)) {
          next();
          return;
        }

        const relativePath = decodeURIComponent(url.slice(POSTS_IMG_URL_PREFIX.length).split('?')[0]);
        const filePath = path.normalize(path.join(POSTS_IMG_SOURCE_DIR, relativePath));

        // 防止路径穿越到目录之外
        if (!filePath.startsWith(POSTS_IMG_SOURCE_DIR + path.sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        const contentType = POSTS_IMG_MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle() {
      if (fs.existsSync(POSTS_IMG_SOURCE_DIR)) {
        fs.cpSync(POSTS_IMG_SOURCE_DIR, path.join(outDir, 'posts-img'), { recursive: true });
      }
    },
  };
};

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
  plugins: [react(), postsImgPublicPlugin()],
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
