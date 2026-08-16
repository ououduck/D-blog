import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { normalizeBasePath } from './config/basePath';

const offlinePostAssetsPlugin = (): Plugin => ({
  name: 'offline-post-assets',
  generateBundle(_options, bundle) {
    const routeChunks = ['Post.tsx', 'Favorites.tsx'].map((fileName) =>
      Object.values(bundle).find(
        (output) =>
          output.type === 'chunk' &&
          Object.keys(output.modules).some((moduleId) =>
            moduleId.replace(/\\/g, '/').endsWith(`/src/pages/${fileName}`),
          ),
      ),
    );
    if (routeChunks.some((chunk) => !chunk || chunk.type !== 'chunk')) {
      // this.error 会抛出 RollupError 中止构建，后续代码不可达。
      this.error('Unable to find the offline route chunks.');
    }

    const assets = new Set<string>();
    const visit = (fileName: string) => {
      if (assets.has(fileName)) return;
      const output = bundle[fileName];
      if (!output) return;
      assets.add(fileName);
      if (output.type === 'chunk') {
        output.imports.forEach(visit);
        const metadata = output.viteMetadata as
          | {
              importedAssets?: Set<string>;
              importedCss?: Set<string>;
            }
          | undefined;
        metadata?.importedAssets?.forEach((asset) => assets.add(asset));
        metadata?.importedCss?.forEach((asset) => assets.add(asset));
      }
    };

    Object.values(bundle).forEach((output) => {
      if (output.type !== 'chunk') return;
      if (
        output.isEntry ||
        Object.keys(output.modules).some((moduleId) => {
          const normalizedId = moduleId.replace(/\\/g, '/');
          return normalizedId.includes('/posts/') && normalizedId.includes('.md?raw');
        })
      ) {
        visit(output.fileName);
      }
    });
    routeChunks.forEach((chunk) => {
      if (chunk?.type === 'chunk') visit(chunk.fileName);
    });
    this.emitFile({
      type: 'asset',
      fileName: 'offline-post-assets.json',
      source: JSON.stringify({ version: 1, assets: [...assets].sort() }),
    });
  },
});

/**
 * KaTeX 字体冗余裁剪（性能优化）。
 *
 * katex.min.css 为每个字重声明三种格式：woff2 / woff / ttf，其中 ttf 仅供
 * 不识别 woff/woff2 的极旧浏览器使用，纯属冗余体积（20 个文件约 514KB）。
 * 本插件在 generateBundle 阶段只处理 KaTeX 字体资产：
 * 1. 重写 KaTeX CSS 的 @font-face：src 列表删除 truetype 条目，保留 woff2
 *    （现代浏览器首选）+ woff（旧浏览器兜底），数学公式渲染不受影响；
 * 2. 收集全部 CSS 中仍被 url() 引用的字体文件名，删除不再被引用的 KaTeX
 *    ttf 字体文件（bundle 内不会残留对已删文件的引用，避免 404）。
 * 不触碰 favicon / logo / PWA 图标 / 封面图等其他任何资产。
 */
const trimKatexFonts = (): Plugin => {
  // 匹配 src 列表末尾的 ttf 条目：,url(fonts/xxx.ttf) format("truetype")
  // 兼容单/双引号与缺失 format 的写法（cssnano 压缩产物可能改写引号风格）。
  const TTF_ENTRY = /,\s*url\((?:"[^"]*"|'[^']*'|[^)'"]*?)\.ttf\)\s*format\(["']truetype["']\)/g;
  const TTF_ENTRY_BARE = /,\s*url\((?:"[^"]*"|'[^']*'|[^)'"]*?)\.ttf\)/g;
  return {
    name: 'trim-katex-fonts',
    apply: 'build',
    generateBundle(_options, bundle) {
      const katexCssAssets = Object.values(bundle).filter(
        (output): output is Extract<typeof output, { type: 'asset' }> =>
          output.type === 'asset' && /(^|\/)katex-[^/]*\.css$/.test(output.fileName),
      );
      if (katexCssAssets.length === 0) {
        return;
      }

      // 1. 重写 KaTeX CSS 的 @font-face，仅删除 ttf 条目（woff2/woff 原样保留）。
      for (const asset of katexCssAssets) {
        const source = asset.source.toString();
        asset.source = source.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
          if (!/font-family\s*:\s*KaTeX_/.test(block)) {
            return block;
          }
          return block.replace(TTF_ENTRY, '').replace(TTF_ENTRY_BARE, '');
        });
      }

      // 2. 重写后再收集所有 CSS 的实际引用（此时 ttf 已从 src 移除），
      //    删除未被引用的 KaTeX ttf 字体文件。
      const referencedFonts = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !output.fileName.endsWith('.css')) {
          continue;
        }
        for (const match of output.source.toString().matchAll(/url\(([^)]+)\)/g)) {
          const url = match[1].replace(/["']/g, '').split(/[?#]/)[0];
          if (url) {
            referencedFonts.add(path.posix.basename(url));
          }
        }
      }
      for (const fileName of Object.keys(bundle)) {
        if (!fileName.endsWith('.ttf')) {
          continue;
        }
        if (/KaTeX|katex/i.test(fileName) && !referencedFonts.has(path.posix.basename(fileName))) {
          delete bundle[fileName];
        }
      }
    },
  };
};

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
        const entryChunk = Object.values(ctx.bundle).find((output) => output.type === 'chunk' && output.isEntry);
        const importedCss = entryChunk?.type === 'chunk' ? entryChunk.viteMetadata?.importedCss : undefined;
        if (!importedCss || importedCss.size === 0) {
          return;
        }
        const cssFileName = [...importedCss][0];
        const href = base === './' ? cssFileName : `${base.replace(/\/+$/, '')}/${cssFileName}`.replace(/\/+/g, '/');
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
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const appBase = normalizeBasePath(env.VITE_BASE_PATH);

  return {
    plugins: [react(), injectEntryCssPreload(), offlinePostAssetsPlugin(), trimKatexFonts()],
    base: appBase,
    esbuild:
      command === 'build'
        ? {
            // BUILD_KEEP_CONSOLE=1 时保留 console（调试 hydration 警告等），默认构建仍移除。
            drop: process.env.BUILD_KEEP_CONSOLE === '1' ? [] : ['console', 'debugger'],
          }
        : undefined,
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
