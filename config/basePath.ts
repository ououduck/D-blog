/**
 * Vite 构建配置的 base path 归一化（纯函数，无 Node 依赖）。
 *
 * 客户端构建（vite.config.ts）与 SSR 构建（vite.ssr.config.ts）必须使用
 * 同一实现：两处 base 不一致会导致 import.meta.env.BASE_URL 在两端不同，
 * 水合期资源路径错乱。此前两份拷贝已出现行为漂移，统一收拢到本模块。
 * 脚本侧（Node 直跑）的同类逻辑见 scripts/base-path.mjs。
 */
const normalizeBasePath = (value?: string): string => {
  let trimmed = value?.trim().replace(/\\/g, '/');
  if (!trimmed) {
    return '/';
  }

  // Git Bash 可能把 /repo/ 改写成自身文件系统路径后再传给 npm，
  // 识别 MSYS 安装路径形态并还原为 URL 形态。
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

export { normalizeBasePath };
