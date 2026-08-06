import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * 文章配图位于仓库根目录 posts-img/（与 Markdown 中的 /posts-img/ 绝对链接对应，
 * 便于 Obsidian 以 vault 根为基准预览）。
 * 该插件保持 /posts-img/* 的公开访问路径不变：
 * - 开发服务器：将 /posts-img/* 请求转发到根目录 posts-img/*
 * - 生产构建：构建完成后把根目录 posts-img/* 拷贝到 dist/posts-img/*
 */
const POSTS_IMG_SOURCE_DIR = path.resolve(__dirname, './posts-img');
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

const offlinePostAssetsPlugin = (): Plugin => ({
  name: 'offline-post-assets',
  generateBundle(_options, bundle) {
    const routeChunks = ['Post.tsx', 'Favorites.tsx'].map((fileName) => (
      Object.values(bundle).find((output) => (
        output.type === 'chunk'
        && Object.keys(output.modules).some((moduleId) => (
          moduleId.replace(/\\/g, '/').endsWith(`/src/pages/${fileName}`)
        ))
      ))
    ));
    if (routeChunks.some((chunk) => !chunk || chunk.type !== 'chunk')) {
      this.error('Unable to find the offline route chunks.');
      return;
    }

    const assets = new Set<string>();
    const visit = (fileName: string) => {
      if (assets.has(fileName)) return;
      const output = bundle[fileName];
      if (!output) return;
      assets.add(fileName);
      if (output.type === 'chunk') {
        output.imports.forEach(visit);
        const metadata = output.viteMetadata as {
          importedAssets?: Set<string>;
          importedCss?: Set<string>;
        } | undefined;
        metadata?.importedAssets?.forEach((asset) => assets.add(asset));
        metadata?.importedCss?.forEach((asset) => assets.add(asset));
      }
    };

    Object.values(bundle).forEach((output) => {
      if (output.type !== 'chunk') return;
      if (output.isEntry || Object.keys(output.modules).some((moduleId) => {
        const normalizedId = moduleId.replace(/\\/g, '/');
        return normalizedId.includes('/posts/') && normalizedId.includes('.md?raw');
      })) {
        visit(output.fileName);
      }
    });
    routeChunks.forEach((chunk) => {
      if (chunk?.type === 'chunk') visit(chunk.fileName);
    });
    this.emitFile({
      type: 'asset',
      fileName: 'offline-post-assets.json',
      source: JSON.stringify({ version: 1, assets: [...assets].sort() })
    });
  }
});

const postsImgPublicPlugin = (): Plugin => {
  let outDir = 'dist';
  let isBuild = false;
  let basePath = '/';

  return {
    name: 'posts-img-public-mapping',
    configResolved(config) {
      outDir = config.build.outDir;
      isBuild = config.command === 'build';
      basePath = config.base === './' ? '/' : config.base;
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || '';
        const requestPath = url.split('?')[0];
        const publicPrefixes = basePath === '/'
          ? [POSTS_IMG_URL_PREFIX]
          : [POSTS_IMG_URL_PREFIX, `${basePath.replace(/\/$/, '')}${POSTS_IMG_URL_PREFIX}`];
        const matchedPrefix = publicPrefixes.find((prefix) => requestPath.startsWith(`${prefix}/`));
        if (!matchedPrefix) {
          next();
          return;
        }

        let relativePath;
        try {
          relativePath = decodeURIComponent(requestPath.slice(matchedPrefix.length));
        } catch {
          res.statusCode = 400;
          res.end('Bad Request');
          return;
        }
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
      // 仅在真正的构建（vite build）时把配图拷贝进产物目录；
      // vitest 会以 dev server 方式加载本插件，并把 build.outDir 覆盖为
      // 占位符 "dummy-non-existing-folder"，此时必须跳过，避免生成垃圾目录。
      if (!isBuild) {
        return;
      }
      if (fs.existsSync(POSTS_IMG_SOURCE_DIR)) {
        fs.cpSync(POSTS_IMG_SOURCE_DIR, path.join(outDir, 'posts-img'), { recursive: true });
      }
    },
  };
};

// Use loadEnv inside defineConfig so .env values are available during Vite config evaluation.
const normalizeBasePath = (value?: string) => {
  let trimmed = value?.trim().replace(/\\/g, '/');
  if (!trimmed) {
    return '/';
  }

  // Git Bash may rewrite /repo/ into its own filesystem path before npm runs.
  const msysGitPath = trimmed.match(/^[a-z]:\//i) ? trimmed.match(/\/git\/(.+)$/i) : null;
  if (msysGitPath?.[1]) {
    trimmed = `/${msysGitPath[1]}`;
  }

  if (trimmed === '.' || trimmed === './') {
    return './';
  }

  const normalized = trimmed.replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}/` : '/';
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const appBase = normalizeBasePath(env.VITE_BASE_PATH);

  return {
    plugins: [react(), offlinePostAssetsPlugin(), postsImgPublicPlugin()],
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
  };
});
