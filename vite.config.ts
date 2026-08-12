import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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

/**
 * 构建时注入入口 CSS 的 <link rel="preload">。
 *
 * 入口样式表使用内容哈希文件名（assets/index-<hash>.css），名称只在构建完成
 * 后可知，无法在 index.html 模板里硬编码。这里在 build 阶段的 transformIndexHtml
 * 中读取输出 bundle：入口 chunk 的 viteMetadata.importedCss 即 Vite 即将注入的
 * 入口样式表，返回带 crossorigin 的 preload tag，由 Vite 与正式 stylesheet link
 * 一同渲染进产物 index.html：
 * - preload 与正式请求共享同一 URL，跨域属性保持一致，避免被判定为两个请求而重复下载。
 * - 模板快照（dist-ssr/index.template.html）取自构建后的 dist/index.html，
 *   SSG 全量静态化时该 preload 会随模板保留到每个页面。
 */
const injectEntryCssPreload = (): Plugin => {
  let base = '/';
  return {
    name: 'inject-entry-css-preload',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post' as const,
      handler(_html, ctx) {
        if (ctx.server || !ctx.bundle) {
          return;
        }
        const entryChunk = Object.values(ctx.bundle).find(
          (output) => output.type === 'chunk' && output.isEntry
        );
        const importedCss = entryChunk?.type === 'chunk' ? entryChunk.viteMetadata?.importedCss : undefined;
        if (!importedCss || importedCss.size === 0) {
          return;
        }
        const cssFileName = [...importedCss][0];
        const href = base === './'
          ? cssFileName
          : `${base.replace(/\/+$/, '')}/${cssFileName}`.replace(/\/+/g, '/');
        // 直接返回 HtmlTagDescriptor[]：Vite 将其注入原始 HTML（head-prepend），
        // 与返回 { html, tags } 的对象形式行为一致且满足 IndexHtmlTransformResult 类型。
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'style',
              href,
              crossorigin: true,
            },
            injectTo: 'head-prepend' as const,
          },
        ];
      },
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
    plugins: [react(), injectEntryCssPreload(), offlinePostAssetsPlugin()],
    base: appBase,
    esbuild: command === 'build' ? {
      // BUILD_KEEP_CONSOLE=1 时保留 console（调试 hydration 警告等），默认构建仍移除。
      drop: process.env.BUILD_KEEP_CONSOLE === '1' ? [] : ['console', 'debugger'],
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
          // 所有资源（含 CSS）均带内容哈希：样式变更必然产生新 URL，
          // 避免服务工作者 stale-while-revalidate 命中旧缓存导致“首次打开
          // 样式落后、刷新才正常”（曾用稳定 assets/index.css + HTTP
          // 强 revalidate 方案，被 SW 缓存绕过，见 public/_headers 注释）。
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          // 厂商分块：Layout（Navbar）与 Home 均 eager 引用 framer-motion /
          // react-dom / react-router，不拆则三者全部塞进入口 chunk（~475KB），
          // 移动端 4× CPU 节流下解析/编译成为 TBT 主因。拆分后：
          // 1) HTTP/2 并行下载多个小 chunk（总字节不变但首字节更早到达）；
          // 2) V8 对各 chunk 独立惰性编译，减少主线程长任务；
          // 3) 厂商代码变更频率低于业务代码，长期缓存命中率更高。
          // Vite 会自动为入口 chunk 的依赖生成 <link rel=modulepreload>，
          // 浏览器在解析入口 script 前即开始拉取厂商 chunk。
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
              return 'motion';
            }
            if (id.includes('react-router')) {
              return 'router';
            }
            if (id.includes('react-dom') || id.includes('scheduler') || /[\\/]node_modules[\\/]react[\\/]/.test(id)) {
              return 'react-vendor';
            }
          },
        },
      },
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      minify: 'esbuild',
    },
    publicDir: 'public',
  };
});
