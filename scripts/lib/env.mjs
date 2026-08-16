/**
 * 环境变量数值解析：未设置/空/非法时回退默认值，显式 0 保留。
 *
 * 原 `Number(process.env.X) || 默认` 模式会把显式 0 静默当成默认值，导致
 * 有意义的 0 失效：如 FRIEND_LINK_CHECK_RETRIES=0（不重试）、
 * BUILD_STAGE_TIMEOUT_MS=0（立即触发超时击杀，用于测试超时路径）、
 * FRIEND_LINK_WAIT_MS=0（跳过冷却等待）。
 */
export const parseEnvNumber = (value, fallback) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
