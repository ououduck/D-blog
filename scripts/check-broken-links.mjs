/**
 * check-broken-links.mjs — 文章外链失效扫描（构建期/CI 运行，不占运行时）。
 *
 * 博客内容会随外部站点改版/下线产生死链，且完全可以在构建期检测。
 * 本脚本：
 *   1. 扫描 posts/*.md 中全部 http/https 外链（Markdown 链接 + HTML <a href>，
 *      排除图片与站内锚点）；
 *   2. 逐个请求检查可达性（超时/重定向跟随/网络错误分类）；
 *   3. 汇总失效链接（按文章分组、带行号与状态/原因）；
 *   4. 推送到 Telegram（复用 lib/telegram.mjs，配置缺失优雅跳过）。
 *
 * 运行：node scripts/check-broken-links.mjs
 * 可选：--dry-run（只打印不上报）、--fail（发现失效链接时非零退出，默认仅报告）。
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import { sendTelegramMessage } from './lib/telegram.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';

const logger = createActionLogger('link-check');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT_DIR, 'posts');

/** 单次请求超时（毫秒）：覆盖 DNS+TLS+响应头全程。 */
const REQUEST_TIMEOUT_MS = 12000;
/** 相邻请求间隔（毫秒）：对外部站点保持礼貌，避免被封。 */
const REQUEST_DELAY_MS = 150;

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const failOnBroken = args.includes('--fail');

/**
 * 从 Markdown 正文提取外链（http/https）。
 * 返回 [{ url, line, type }]；排除图片（![...]）与站内/锚点链接。
 * 导出供单元测试。
 * @param {string} content
 * @returns {Array<{ url: string, line: number, type: 'md' | 'html' }>}
 */
export const extractExternalLinks = (content) => {
  const results = [];
  const lines = content.split(/\r?\n/);

  const cleanUrl = (raw) => {
    let url = String(raw).trim();
    // 剥离 HTML 引号/尖括号闭合。
    url = url.replace(/["'<>]+$/, '');
    // 平衡括号：URL 内部括号（如维基 Foo_(bar)）合法，仅当右括号多于左括号时
    // 剥除尾部 ')'（Markdown 链接闭合符），避免误伤 URL 自身的右括号。
    let opens = (url.match(/\(/g) ?? []).length;
    let closes = (url.match(/\)/g) ?? []).length;
    while (closes > opens && url.endsWith(')')) {
      url = url.slice(0, -1);
      closes -= 1;
    }
    // 去除尾部行尾标点。
    url = url.replace(/[.,;:!?]+$/, '');
    return url;
  };

  lines.forEach((line, index) => {
    // Markdown 链接 [text](url) 或 [text](url "title")：排除图片 ![..]。
    // URL 段支持一层嵌套括号（维基式 URL 如 .../Foo_(bar)）。
    const mdRe = /(?<!!)\[[^\]]*\]\(\s*(https?:\/\/[^\s()]*(?:\([^)]*\))?[^\s()]*)/g;
    let match;
    while ((match = mdRe.exec(line)) !== null) {
      const url = cleanUrl(match[1]);
      if (url) results.push({ url, line: index + 1, type: 'md' });
    }

    // HTML <a href="url">（单/双引号）。
    const htmlRe = /<a\b[^>]*?\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
    while ((match = htmlRe.exec(line)) !== null) {
      const url = cleanUrl(match[1]);
      if (url) results.push({ url, line: index + 1, type: 'html' });
    }
  });

  return results;
};

/**
 * 检查单个 URL 的可达性。
 * 返回 { ok: boolean, status?: number, error?: string }。
 */
const checkUrl = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'D-blog-LinkChecker/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    // 释放响应体（不下载页面内容），仅保留状态。
    await response.body?.cancel().catch(() => {});
    const ok = response.ok || (response.status >= 300 && response.status < 400);
    return ok ? { ok: true, status: response.status } : { ok: false, status: response.status };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return {
      ok: false,
      error: aborted ? 'timeout' : error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const main = async () => {
  if (!fs.existsSync(POSTS_DIR)) {
    logger.warn('posts 目录不存在，跳过外链检查', { path: POSTS_DIR });
    return 0;
  }

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith('.md'))
    .filter((file) => fs.statSync(path.join(POSTS_DIR, file)).isFile())
    .sort();

  logger.startGroup('Scan external links');
  logger.info(`Scan external links in ${files.length} posts`);

  // 提取全部链接（含行号），按 URL 去重后检查。
  const linkRecords = []; // { file, line, url, type }
  for (const file of files) {
    let parsed;
    try {
      parsed = matter(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'));
    } catch (error) {
      logger.warn(`无法解析 ${file}，跳过`, error instanceof Error ? error.message : String(error));
      continue;
    }
    for (const { url, line, type } of extractExternalLinks(parsed.content)) {
      linkRecords.push({ file, line, url, type });
    }
  }

  logger.info('Collected external links', `files=${files.length} links=${linkRecords.length}`);

  const uniqueUrls = [...new Set(linkRecords.map((record) => record.url))];
  const broken = []; // { url, status?, error? }
  let checkedCount = 0;

  for (const url of uniqueUrls) {
    const result = await checkUrl(url);
    checkedCount += 1;
    if (!result.ok) {
      broken.push({ url, ...result });
      logger.warn('Broken link', `${url} (${result.status ? `HTTP ${result.status}` : result.error})`);
    }
    if (checkedCount % 10 === 0) {
      logger.info('Progress', `checked=${checkedCount}/${uniqueUrls.length} broken=${broken.length}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const brokenLinks = broken.length;
  logger.info('Check complete', `checked=${uniqueUrls.length} broken=${brokenLinks}`);

  if (brokenLinks === 0) {
    logger.info('No broken links found', `checked=${uniqueUrls.length}`);
    return 0;
  }

  // 按文件分组生成报告。
  const byFile = new Map();
  for (const record of linkRecords) {
    if (!broken.some((b) => b.url === record.url)) continue;
    const list = byFile.get(record.file) ?? [];
    list.push(record);
    byFile.set(record.file, list);
  }

  const lines = [`<b>🔗 D-blog 发现 ${brokenLinks} 个失效外链</b>`, ''];
  for (const [file, records] of byFile) {
    lines.push(`<b>${escapeHtml(file)}</b>`);
    for (const record of records) {
      const detail = broken.find((b) => b.url === record.url);
      const reason = detail?.status ? `HTTP ${detail.status}` : escapeHtml(detail?.error ?? '未知错误');
      lines.push(`  L${record.line} ${escapeHtml(record.url)} — ${reason}`);
    }
    lines.push('');
  }
  lines.push(`共检查 ${uniqueUrls.length} 个唯一外链。`);
  const report = lines.join('\n');

  if (!isDryRun) {
    try {
      const result = await sendTelegramMessage(report);
      if (result !== null) {
        logger.info('Broken link report sent to Telegram', { messageId: result.message_id ?? 'unknown' });
      }
    } catch (error) {
      logger.error('Failed to send Telegram report', formatError(error));
    }
  } else {
    console.log(`\n[dry-run] 失效链接报告（未发送）：\n${report}\n`);
  }

  return failOnBroken ? 1 : 0;
};

installGlobalErrorHandlers(logger);

try {
  process.exitCode = await main();
} catch (error) {
  logger.error('check-broken-links failed', formatError(error));
  process.exitCode = 1;
}
