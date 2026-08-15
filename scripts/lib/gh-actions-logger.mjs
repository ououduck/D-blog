/**
 * gh-actions-logger.mjs — GitHub Actions 结构化日志模块（防御性重构最终版）。
 *
 * 在上一版基础上的关键加固（Phase 3/4）：
 * 1. 【日志语法注入防护】formatFields 对字段值做换行/CR 净化 —— 恶意 Issue 标题、
 *    正文、评论正文若含 `\r\n` 或 `::error::` 等 Actions 命令序列，会被写入日志行，
 *    轻则污染日志检索、重则伪造 ::error:: 注解误导排查。所有字段值统一
 *    `\r` / `\n` → 空格，从根上消除注入面。
 * 2. 【Summary 面板】新增 summaryTable(stats)：输出 GitHub Actions 的
 *    ::summary:: 多行 Markdown 表格，运行结果在 Actions 页面顶部一眼可见，
 *    无需翻完整日志。
 * 3. 【title 长度防护】::group::/::warning:: 等注解的标题被 Actions 截断在
 *    一定长度内，超长标题先行裁剪，避免注解行被截断成两半破坏格式。
 * 4. 【错误对象规范化】formatError 支持嵌套 cause 链摘要（最多 3 层），
 *    保留根因定位信息，日志体积仍受控。
 *
 * 约定：不要直接 console.log 裸文本；所有输出经由本模块，保证格式统一。
 */

import fs from 'node:fs';

const IS_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;

const color = (code, value) => (USE_COLOR ? `\u001B[${code}m${value}\u001B[0m` : value);

/** 注解标题上限（Actions 对 :: 命令行有长度限制，超长会被截断破坏格式）。 */
const MAX_ANNOTATION_TITLE_CHARS = 200;

/**
 * 净化日志字段值：移除控制字符与换行，防止 Actions 命令注入（::error:: 等）。
 * @param {string} value
 * @returns {string}
 */
const sanitizeLogValue = (value) =>
  String(value)
    // \r \n 与 \u2028 \u2029 全部折叠为空格（Actions 注解与普通日志均按行解析）。
    .replace(/[\r\n\u2028\u2029]/g, ' ')
    // 其余 C0 控制字符（除 \t 保留用于对齐）替换为空格。
    // eslint-disable-next-line no-control-regex -- 日志净化：有意剔除 C0 控制字符
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim();

/**
 * 把附加字段（对象/数组）格式化为 key=value 追加串。
 * 数组（如失败页列表）以逗号拼接；值为对象时 JSON 序列化。
 * 所有值经 sanitizeLogValue 净化（防 :: 注入）。
 * @param {Record<string, unknown>} fields
 * @returns {string}
 */
const formatFields = (fields = {}) => {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      parts.push(`${key}=${value.map((item) => sanitizeLogValue(item)).join(',')}`);
    } else if (typeof value === 'object') {
      try {
        parts.push(`${key}=${sanitizeLogValue(JSON.stringify(value))}`);
      } catch {
        parts.push(`${key}=<unserializable>`);
      }
    } else {
      parts.push(`${key}=${sanitizeLogValue(value)}`);
    }
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
};

/**
 * 创建带 scope 的 Actions 日志器。
 * @param {string} scope 日志作用域，如 'friend-link' / 'akismet'。
 * @returns {{
 *   info: (message: string, fields?: object) => void,
 *   warn: (message: string, fields?: object) => void,
 *   error: (message: string, fields?: object) => void,
 *   debug: (message: string, fields?: object) => void,
 *   startGroup: (title: string) => void,
 *   endGroup: () => void,
 *   group: (title: string, fn: () => Promise<void> | void) => Promise<void>,
 *   summary: (fields: object) => void,
 *   summaryTable: (title: string, rows: Array<Record<string, string | number>>) => void
 * }}
 */
export const createActionLogger = (scope) => {
  const base = (level, message, fields) => {
    const fieldsText = formatFields(fields);
    const line = `[${scope}] ${message}${fieldsText}`;
    const ts = new Date().toISOString();
    if (IS_ACTIONS) {
      // Actions 原生注解：只对 message 部分注解，字段留在消息里便于检索。
      switch (level) {
        case 'warn':
          console.warn(`::warning::${line.slice(0, MAX_ANNOTATION_TITLE_CHARS)}`);
          break;
        case 'error':
          console.error(`::error::${line.slice(0, MAX_ANNOTATION_TITLE_CHARS)}`);
          break;
        case 'debug':
          console.debug(`::debug::${line.slice(0, MAX_ANNOTATION_TITLE_CHARS)}`);
          break;
        default:
          console.log(`${ts} ${line}`);
      }
    } else if (level === 'warn') {
      console.warn(`${ts} ${color('33', '[warn]')} ${line}`);
    } else if (level === 'error') {
      console.error(`${ts} ${color('31', '[error]')} ${line}`);
    } else if (level === 'debug') {
      console.debug(`${ts} ${color('90', '[debug]')} ${line}`);
    } else {
      console.log(`${ts} ${color('36', `[${scope}]`)} ${message}${fieldsText}`);
    }
  };

  return {
    info(message, fields) {
      base('info', message, fields);
    },
    warn(message, fields) {
      base('warn', message, fields);
    },
    error(message, fields) {
      base('error', message, fields);
    },
    debug(message, fields) {
      if (process.env.ACTIONS_STEP_DEBUG === 'true' || process.env.DEBUG === '1') {
        base('debug', message, fields);
      }
    },
    startGroup(title) {
      // 标题净化 + 裁剪：防恶意 Issue 标题破坏 ::group:: 行结构。
      const safeTitle = sanitizeLogValue(title).slice(0, MAX_ANNOTATION_TITLE_CHARS);
      if (IS_ACTIONS) {
        console.log(`::group::${safeTitle}`);
      } else {
        console.log(`${new Date().toISOString()} ${color('1', `▸ ${safeTitle}`)}`);
      }
    },
    endGroup() {
      if (IS_ACTIONS) {
        console.log('::endgroup::');
      }
    },
    async group(title, fn) {
      this.startGroup(title);
      try {
        await fn();
      } finally {
        this.endGroup();
      }
    },
    summary(fields) {
      base('info', 'summary', fields);
    },
    /**
     * 输出 GitHub Actions Job Summary 面板（Markdown 表格）。
     * 仅 GITHUB_STEP_SUMMARY 环境变量存在（Actions 自动注入）时生效，
     * 本地运行时回退为普通日志。
     * @param {string} title 表格标题。
     * @param {Array<Record<string, string | number>>} rows 行数据（每行对象 → 表格行）。
     */
    summaryTable(title, rows) {
      const summaryPath = process.env.GITHUB_STEP_SUMMARY;
      const safeRows = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
      if (!summaryPath || safeRows.length === 0) {
        base('info', `summary: ${sanitizeLogValue(title)}`, { rows: safeRows.length });
        return;
      }
      // 动态收集列名（保持首行出现的顺序），字段值一律净化防注入。
      const columns = [];
      for (const row of safeRows) {
        for (const key of Object.keys(row)) {
          if (!columns.includes(key)) columns.push(key);
        }
      }
      const header = `| ${columns.join(' | ')} |`;
      const divider = `| ${columns.map(() => '---').join(' | ')} |`;
      const body = safeRows
        .map((row) => `| ${columns.map((col) => sanitizeLogValue(row[col] ?? '')).join(' | ')} |`)
        .join('\n');
      const markdown = `### ${sanitizeLogValue(title)}\n\n${header}\n${divider}\n${body}\n`;
      try {
        fs.appendFileSync(summaryPath, markdown, 'utf8');
      } catch (error) {
        // Summary 写入失败不影响主流程：回退为普通日志。
        base('warn', `Failed to write step summary: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
};

/**
 * 把任意异常规范化为可读字符串（带 cause 链摘要，控制 Actions 日志体积）。
 * 最多展开 3 层 cause：保留根因信息（如网络错误的底层 DNS 原因），
 * 同时避免过深循环引用（如 TypeError: Cannot read properties of undefined (reading 'x')）。
 * @param {unknown} error
 * @returns {string}
 */
export const formatError = (error) => {
  if (error instanceof Error) {
    const parts = [];
    let current = error;
    for (let depth = 0; current && depth < 3; depth += 1) {
      const firstStackLine = (current.stack || '').split('\n')[1]?.trim() || '';
      parts.push(`${current.name}: ${current.message}${firstStackLine ? ` (${firstStackLine})` : ''}`);
      current = current.cause;
    }
    return parts.join(' <- ');
  }
  return String(error);
};

/**
 * 全局未捕获异常/未处理拒绝的统一处理：打印结构化错误后以非零码退出。
 * 在脚本入口调用，确保任何异步泄漏（unhandledRejection）都不会让 job
 * 以静默方式挂起或输出难以定位的裸堆栈。
 *
 * @param {ReturnType<typeof createActionLogger>} logger
 */
export const installGlobalErrorHandlers = (logger) => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: formatError(error) });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { error: formatError(reason) });
    process.exit(1);
  });
};
