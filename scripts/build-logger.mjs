/**
 * build-logger.mjs — 构建阶段的结构化日志器（start/step/done/warn/error/summary）。
 * 统一 [scope] 前缀、汇总 warnings 计数并输出耗时，供 build/ssg/audit 等脚本复用；
 * 与 GitHub Actions 日志器（lib/gh-actions-logger.mjs）职责互补（构建期 vs 自动化脚本）。
 */

import { sanitizeLogValue } from './lib/gh-actions-logger.mjs';

// detail 按字符串设计，但调用方可能传入对象（如 { path, error }）。
// 对象直接模板拼接会变成 "[object Object]" 丢失数据，这里统一序列化；
// 输出前经 sanitizeLogValue 净化（构建产物里失败汇总可能含用户可控文本，
// 如 post 标题，控制字符/换行会在 Actions 日志中注入伪 ::error:: 行）。
const formatDetail = (detail) => {
  if (detail === undefined || detail === null || detail === '') return '';
  if (typeof detail === 'object') {
    try {
      return ` ${sanitizeLogValue(JSON.stringify(detail))}`;
    } catch {
      return ` ${sanitizeLogValue(String(detail))}`;
    }
  }
  return ` ${sanitizeLogValue(detail)}`;
};

export const createBuildLogger = (scope) => {
  const startedAt = Date.now();
  const warnings = [];

  const write = (level, message, detail = '') => {
    const prefix = `[${scope}] ${level}`;
    console.log(`${prefix} ${message}${formatDetail(detail)}`);
  };

  return {
    start(message) {
      write('start', message);
    },
    step(message, detail = '') {
      write('step', message, detail);
    },
    success(message, detail = '') {
      write('done', message, detail);
    },
    warn(message, detail = '', output = true) {
      const text = `${message}${formatDetail(detail)}`;
      warnings.push(text);
      if (output) console.warn(`[${scope}] warn ${text}`);
    },
    error(message, detail = '') {
      console.error(`[${scope}] error ${message}${formatDetail(detail)}`);
    },
    summary(items = {}) {
      const elapsed = `${((Date.now() - startedAt) / 1000).toFixed(2)}s`;
      const parts = Object.entries({ ...items, warnings: warnings.length, elapsed })
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');

      write('summary', parts);
    },
  };
};
