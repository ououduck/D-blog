import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * SSR 构建配置：把 src/ssr-entry.tsx 编译为 Node 可用的服务端渲染 bundle（dist-ssr/），
 * 供 scripts/ssg.mjs 在构建期渲染每个页面的完整静态 HTML。
 * base 与主构建保持一致，确保 import.meta.env.BASE_URL（getSiteBasePath 依赖它）在两端一致。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  const normalizeBasePath = (value?: string) => {
    const trimmed = value?.trim().replace(/\\/g, '/');
    if (!trimmed) {
      return '/';
    }
    // 与 vite.config.ts 保持一致：Git Bash 会把 URL 形态的环境变量值
    // （如 "/repo/"）改写成 MSYS 安装路径，SSR 与客户端 base 必须同源，
    // 否则 getSiteBasePath() 两端不一致会导致水合期资源路径错乱。
    const msysGitPath = trimmed.match(/^[a-z]:\//i) ? trimmed.match(/\/git\/(.+)$/i) : null;
    const normalized = msysGitPath?.[1] ? `/${msysGitPath[1]}` : trimmed;
    if (normalized === '.' || normalized === './') {
      return './';
    }
    const clean = normalized.replace(/^\/+|\/+$/g, '');
    return clean ? `/${clean}/` : '/';
  };

  return {
    plugins: [react()],
    base: normalizeBasePath(env.VITE_BASE_PATH),
    esbuild: {
      drop: ['console', 'debugger'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@config': path.resolve(__dirname, './config'),
      },
    },
    build: {
      outDir: 'dist-ssr',
      sourcemap: false,
      target: 'node20',
      minify: false,
      ssr: 'src/ssr-entry.tsx',
      rollupOptions: {
        output: {
          entryFileNames: 'entry-server.js',
          chunkFileNames: 'assets/[name]-[hash].js',
        },
      },
    },
  };
});
