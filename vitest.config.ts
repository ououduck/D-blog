import { defineConfig } from 'vitest/config';
import type { UserConfig } from 'vite';
import viteConfigExport from './vite.config';

/**
 * 复用 vite.config.ts 的 resolve.alias（@ → ./src、@config → ./config），
 * 保证测试环境与构建/开发环境的模块解析完全一致。
 *
 * vite.config.ts 的默认导出是 defineConfig 回调（UserConfigFn），
 * 以 serve/test 环境调用一次即可取到其配置对象。
 */
const resolveViteConfig = async (): Promise<UserConfig> => {
  if (typeof viteConfigExport === 'function') {
    return await viteConfigExport({ command: 'serve', mode: 'test' });
  }
  return viteConfigExport;
};

const resolvedViteConfig = await resolveViteConfig();

export default defineConfig({
  esbuild: {
    // 与 @vitejs/plugin-react 的 JSX 处理保持一致（react-jsx 自动运行时），
    // 否则测试文件里的 TSX 会按 classic 转换，运行时需要显式引入 React。
    jsx: 'automatic',
  },
  resolve: {
    alias: resolvedViteConfig.resolve?.alias,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'scripts/lib/**/*.mjs'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.test-d.ts', 'src/test/**', 'src/vite-env.d.ts'],
    },
  },
});
