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
 * 可选：
 *   --dry-run                只打印不上报（不发送 Telegram）；
 *   --fail                   发现失效链接时非零退出（默认仅报告，exit 0）；
 *   --ignore-hosts=a.com,b   跳过指定域名（逗号分隔，忽略大小写），
 *                            用于已知反爬/机器人拦截的站点（如 Cloudflare
 *                            Dashboard 对非浏览器 GET 返回 403，属误报）。
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath, pathToFileURL } from 'url';
import { maskFencedCodeBlocks } from '../src/utils/headings-core.mjs';
import { sendTelegramMessage } from './lib/telegram.mjs';
import {
  fetchWithRetry,
  RetryableHttpError,
  isSafePublicHttpUrl,
  safeFetchAgent,
  sanitizeUrlForLogs,
} from './lib/http.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';

const logger = createActionLogger('link-check');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT_DIR, 'posts');

/** 单次请求超时（毫秒）：覆盖 DNS+TLS+响应头全程。 */
const REQUEST_TIMEOUT_MS = 12000;
/** 瞬时抖动/5xx 的重试次数（不含首次）；重试耗尽仍失败才判为死链。 */
const REQUEST_RETRIES = 1;
/** 相邻请求间隔（毫秒）：对外部站点保持礼貌，避免被封。 */
const REQUEST_DELAY_MS = 150;

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const failOnBroken = args.includes('--fail');

/**
 * 解析 --ignore-hosts=a.com,b.com 参数 → 小写域名集合。
 * 导出供单元测试。
 * @param {string[]} argv
 * @returns {Set<string>}
 */
export const parseIgnoreHosts = (argv = process.argv.slice(2)) => {
  const flag = argv.find((arg) => arg.startsWith('--ignore-hosts='));
  if (!flag) return new Set();
  return new Set(
    flag
      .slice('--ignore-hosts='.length)
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
};

/** 提取 URL 的主机名（小写）；解析失败返回空串。 */
const getHost = (url) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/**
 * 从 Markdown 正文提取外链（http/https）。
 * 返回 [{ url, line, type }]；排除图片（![...]）与站内/锚点链接。
 * 导出供单元测试。
 * @param {string} content
 * @returns {Array<{ url: string, line: number, type: 'md' | 'html' }>}
 */
export const extractExternalLinks = (content) => {
  const results = [];
  // 先屏蔽围栏/缩进代码块与 HTML 注释（保留换行与列位，行号不受影响）：
  // 技术文章代码示例里的 https://example.com 等 URL 不应被当作真实外链检查
  // （示例域名可能早已下线/反爬，逐个请求只会制造误报）。
  const masked = maskFencedCodeBlocks(content)
    // 行内代码（`...` / ``...``）同样屏蔽：`` `[foo](bar)` `` 里的括号结构不是链接。
    .replace(/`{1,2}[^`\n]+`{1,2}/g, (match) => ' '.repeat(match.length));
  const lines = masked.split(/\r?\n/);

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
 * 复用 fetchWithRetry：网络瞬时抖动（DNS/连接/5xx）自动退避重试，
 * 单次超时不再是「一次抖动即判失效」的误报来源。
 *
 * SSRF 跳转防护：redirect 改 manual 逐跳跟随，每一跳都重新
 * isSafePublicHttpUrl 校验 —— 初始 URL 安全不代表重定向目标安全，
 * 公开站点可 302 到 127.0.0.1 / 169.254.169.254 等内网地址形成绕过。
 * 导出供单元测试（SSRF 拦截/重定向逐跳校验）。
 */
const MAX_REDIRECTS = 5;

export const checkUrl = async (url) => {
  let current = url;
  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const isSafe = await isSafePublicHttpUrl(current);
      if (!isSafe) {
        return { ok: false, error: 'blocked: 非公开 HTTP(S) 地址（SSRF 防护拦截）' };
      }

      const response = await fetchWithRetry(
        current,
        {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent': 'D-blog-LinkChecker/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        {
          timeoutMs: REQUEST_TIMEOUT_MS,
          retries: REQUEST_RETRIES,
          // 连接期逐 IP 私网校验（防 pre-flight 通过后的 DNS 重绑定）。
          dispatcher: safeFetchAgent,
        },
      );

      // 3xx：读取 Location 继续下一跳（下一轮循环开头重新做 SSRF 校验）。
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        // 释放响应体（不下载重定向中间页内容）。
        await response.body?.cancel().catch(() => {});
        if (!location) {
          return { ok: false, error: '重定向缺少 Location' };
        }
        try {
          current = new URL(location, current).toString();
        } catch {
          return { ok: false, error: '重定向 Location 非法' };
        }
        continue;
      }

      // 释放响应体（不下载页面内容），仅保留状态。
      await response.body?.cancel().catch(() => {});
      const ok = response.ok || (response.status >= 300 && response.status < 400);
      return ok ? { ok: true, status: response.status } : { ok: false, status: response.status };
    }
    // 重定向超过 MAX_REDIRECTS 跳：判为失效（防重定向环）。
    return { ok: false, error: `重定向超过 ${MAX_REDIRECTS} 跳` };
  } catch (error) {
    // fetchWithRetry 重试耗尽后抛 RetryableHttpError（含最终状态/网络错误信息）。
    return {
      ok: false,
      error:
        error instanceof RetryableHttpError
          ? `${error.status ? `HTTP ${error.status}` : 'network'} (${error.attempts} 次尝试)`
          : error instanceof Error
            ? error.message
            : String(error),
    };
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
  // 应用忽略名单：已知反爬/机器人拦截的域名直接跳过，不发起请求、不计入检查。
  const ignoredHosts = parseIgnoreHosts();
  const urlsToCheck = uniqueUrls.filter((url) => !ignoredHosts.has(getHost(url)));
  if (urlsToCheck.length < uniqueUrls.length) {
    logger.info(
      'Skipped ignored hosts',
      `ignored=${uniqueUrls.length - urlsToCheck.length} hosts=[${[...ignoredHosts].join(', ')}]`,
    );
  }

  const broken = []; // { url, status?, error? }
  let checkedCount = 0;

  /**
   * 检查单个 URL（SSRF 防护 → fetchWithRetry），维护进度计数与礼貌间隔。
   * 串行检查在链接多时（100+ × 最坏 25s）会远超 workflow 10 分钟上限，
   * 用固定并发池 + 每请求 150ms 节流平衡速度与对目标站点的礼貌。
   */
  const checkOne = async (url) => {
    // SSRF 防护：文章外链经 Pages CMS / PR 可编辑，先确认目标是安全的公开地址
    //（协议/凭据检查 + DNS 解析后逐 IP 私网校验，fail-closed）；内网/回环/本地
    // 地址不发起请求，直接判为不可访问（这类链接对公网读者同样无效）。
    // 重定向链的逐跳校验在 checkUrl 内部完成（redirect: 'manual' 每跳重新校验）。
    const isSafe = await isSafePublicHttpUrl(url);
    if (!isSafe) {
      broken.push({ url, error: 'blocked: 非公开 HTTP(S) 地址（SSRF 防护拦截）' });
      logger.warn('Blocked non-public URL', sanitizeUrlForLogs(url));
    } else {
      const result = await checkUrl(url);
      if (!result.ok) {
        broken.push({ url, ...result });
        logger.warn(
          'Broken link',
          `${sanitizeUrlForLogs(url)} (${result.status ? `HTTP ${result.status}` : result.error})`,
        );
      }
    }
    checkedCount += 1;
    if (checkedCount % 10 === 0) {
      logger.info('Progress', `checked=${checkedCount}/${urlsToCheck.length} broken=${broken.length}`);
    }
    await sleep(REQUEST_DELAY_MS);
  };

  const CHECK_CONCURRENCY = 4;
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(CHECK_CONCURRENCY, urlsToCheck.length) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= urlsToCheck.length) return;
      await checkOne(urlsToCheck[index]);
    }
  });
  await Promise.all(workers);

  const brokenLinks = broken.length;
  logger.info('Check complete', `checked=${urlsToCheck.length} broken=${brokenLinks}`);

  if (brokenLinks === 0) {
    logger.info('No broken links found', `checked=${urlsToCheck.length}`);
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
  lines.push(
    `共检查 ${urlsToCheck.length} 个唯一外链${urlsToCheck.length < uniqueUrls.length ? `（另跳过 ${uniqueUrls.length - urlsToCheck.length} 个忽略域名）` : ''}。`,
  );
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

// 仅作为主模块直接运行时才执行扫描：被测试/其他模块 import 时
// 不触发任何副作用（避免单测误跑真实网络扫描）。
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  try {
    process.exitCode = await main();
  } catch (error) {
    logger.error('check-broken-links failed', formatError(error));
    process.exitCode = 1;
  }
}
