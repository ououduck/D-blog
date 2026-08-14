/**
 * friend-link-check.mjs — 友链可用状态检查（GitHub Actions 手动触发，可在本地 dry-run）。
 *
 * 功能（与需求一一对应）：
 *  1. 逐个访问 friends/*.json 中每一个友链的站点地址，判断能否正常访问；
 *  2. 无法访问的友链在 JSON 中写入 `"unavailable": true`（友链页据此归入
 *     「已失联的博客」折叠板块）；可以访问的友链不写该字段；
 *  3. 状态恢复：每次执行都会重新检查全部友链 —— 之前标记为已失联、本次
 *     重新可以访问的友链，自动删除 `unavailable` 标记恢复为正常状态
 *     （防止临时故障被永久误判为失联）；
 *  4. 修改结果以单个 commit 提交并推送（带内重试），不触碰任何其他文件，
 *     不影响 friend-link-bot（友链审核）的 Issue 处理流程 —— 它按字段白名单
 *     写文件，`unavailable` 字段对审核逻辑透明。
 *
 * 运行方式：
 *   node scripts/friend-link-check.mjs            # Actions：检查 → 提交 → 推送
 *   FRIEND_LINK_CHECK_DRY_RUN=1 node scripts/friend-link-check.mjs   # 只报告不写文件
 *   FRIEND_LINK_CHECK_NO_GIT=1  node scripts/friend-link-check.mjs   # 写文件但不提交
 *   FRIEND_LINK_CHECK_DIR=路径   覆盖友链目录（测试用）
 *
 * 可访问性判定（fail-open 倾向，避免误伤）：
 *  - 跟随重定向后最终状态码 < 500（2xx/3xx/4xx）→ 正常（服务器在响应；
 *    403/404 视为站点存活，避免 runner 机房 IP 被 WAF/地域限制误判为失联）；
 *  - 5xx（重试后仍失败）→ 不可访问；
 *  - 网络错误 / DNS 失败 / 连接超时 / TLS 失败 → 不可访问。
 *  每个站点最多尝试 retries+1 次（带指数退避），降低瞬时抖动误判。
 *
 * 运行环境要求：git 可写（Actions 中由 actions/checkout 配置凭据）。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fetchWithRetry,
  sleep,
  computeBackoffDelay,
  RetryableHttpError
} from './lib/http.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';

/* ------------------------------------------------------------------ */
/* 常量与可覆盖配置                                                     */
/* ------------------------------------------------------------------ */

/** 友链目录（可环境变量覆盖，便于本地对临时副本测试）。 */
const FRIENDS_DIR = process.env.FRIEND_LINK_CHECK_DIR || 'friends';

/** 单次请求超时（毫秒），覆盖 DNS+TLS+响应头全程。 */
const CHECK_TIMEOUT_MS = Number(process.env.FRIEND_LINK_CHECK_TIMEOUT_MS) || 20000;

/** 每个站点的额外重试次数（不含首次；总尝试 = retries + 1）。 */
const CHECK_RETRIES = Number(process.env.FRIEND_LINK_CHECK_RETRIES) || 2;

/** 并发检查数：友链数量多时显著缩短总耗时。 */
const CHECK_CONCURRENCY = Number(process.env.FRIEND_LINK_CHECK_CONCURRENCY) || 4;

/** dry-run：只输出检查报告，不写文件、不碰 git。 */
const DRY_RUN = ['1', 'true', 'yes'].includes(String(process.env.FRIEND_LINK_CHECK_DRY_RUN || '').toLowerCase());

/** no-git：写文件但不提交不推送（本地验证序列化/缩进用）。 */
const NO_GIT = ['1', 'true', 'yes'].includes(String(process.env.FRIEND_LINK_CHECK_NO_GIT || '').toLowerCase());

/** git 子命令超时（毫秒）。 */
const GIT_TIMEOUT_MS = 60000;

/** git push 带内重试次数（吸收瞬时网络抖动）。 */
const PUSH_RETRIES = 3;

/** git 推送目标分支：优先显式环境变量，回退 GITHUB_REF_NAME（Actions 自动注入），默认 main。 */
const TARGET_BRANCH = process.env.FRIEND_LINK_TARGET_BRANCH || process.env.GITHUB_REF_NAME || 'main';

const CHECK_USER_AGENT = 'D-blogFriendLinkChecker/1.0';

const logger = createActionLogger('friend-link-check');

/* ------------------------------------------------------------------ */
/* 纯函数：可达性判定 / 文件序列化                                      */
/* ------------------------------------------------------------------ */

/**
 * 检查单个站点是否可正常访问。
 * @param {string} rawUrl 友链 url 字段。
 * @returns {Promise<{ reachable: boolean, detail: string }>}
 */
const checkUrlReachable = async (rawUrl) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { reachable: false, detail: 'URL 无效' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { reachable: false, detail: '非 HTTP(S) 协议' };
  }

  try {
    const response = await fetchWithRetry(url.toString(), {
      // 跟随重定向（Node fetch 默认 follow，最多 20 跳，跳转环抛网络错误）。
      redirect: 'follow',
      headers: {
        'User-Agent': CHECK_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'
      }
    }, {
      retries: CHECK_RETRIES,
      timeoutMs: CHECK_TIMEOUT_MS,
      onRetry: (info) => logger.warn('Retrying friend check', {
        host: url.hostname,
        attempt: info.attempt,
        status: info.status ?? 'network',
        delayMs: info.delayMs
      })
    });

    // 只关心状态码：立即取消 body 释放连接，不做内容读取（快且不会因
    // 慢速 body 挂起）。状态码 < 500 视为站点存活（服务器已响应）。
    await response.body?.cancel().catch(() => {});
    const status = response.status;
    return status < 500
      ? { reachable: true, detail: `HTTP ${status}` }
      : { reachable: false, detail: `HTTP ${status}` };
  } catch (error) {
    if (error instanceof RetryableHttpError) {
      const kind = error.status ? `HTTP ${error.status}` : '网络错误';
      return { reachable: false, detail: `${kind}（尝试 ${error.attempts} 次）` };
    }
    return { reachable: false, detail: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * 检测 JSON 文件使用的缩进宽度（4 空格 / 2 空格），重写时保留原缩进，
 * 使每次执行只产生最小 diff（只增删 unavailable 行，不整文件重排）。
 * @param {string} content
 * @returns {number}
 */
const detectIndent = (content) => (/^ {4}"/m.test(content) ? 4 : 2);

/**
 * 带并发上限的 map（友链多时避免串行等待拖长 job）。
 * @param {Array<T>} items
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @param {number} concurrency
 * @returns {Promise<Array<R>>}
 */
const mapWithConcurrency = async (items, mapper, concurrency) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
};

/* ------------------------------------------------------------------ */
/* Git 事务：add → commit → push（全部带超时，与 friend-link-bot 同套路） */
/* ------------------------------------------------------------------ */

/**
 * 提交并推送友链状态变更（幂等 + push 带内重试）。
 * @param {string[]} changedFiles 实际发生变化的文件相对路径。
 * @returns {Promise<string | null>} 提交短 SHA；无改动时返回 null。
 */
const commitAndPush = async (changedFiles) => {
  execFileSync('git', ['add', ...changedFiles], { timeout: GIT_TIMEOUT_MS, stdio: 'pipe' });
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    stdio: 'pipe'
  }).trim();
  if (!staged) {
    logger.info('Nothing staged, skipping commit');
    return null;
  }

  execFileSync('git', [
    '-c', 'user.name=github-actions[bot]',
    '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit', '-m', 'chore: update friend link availability status'
  ], { timeout: GIT_TIMEOUT_MS, stdio: 'pipe' });

  let lastError = null;
  for (let attempt = 1; attempt <= PUSH_RETRIES; attempt += 1) {
    try {
      execFileSync('git', ['push', 'origin', `HEAD:${TARGET_BRANCH}`], { timeout: GIT_TIMEOUT_MS, stdio: 'pipe' });
      return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        encoding: 'utf8',
        timeout: GIT_TIMEOUT_MS,
        stdio: 'pipe'
      }).trim();
    } catch (error) {
      lastError = error;
      if (attempt < PUSH_RETRIES) {
        const delayMs = computeBackoffDelay(attempt, 2000, 10000);
        logger.warn('git push failed, retrying', { attempt, delayMs, error: formatError(error) });
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
};

/* ------------------------------------------------------------------ */
/* 业务逻辑                                                            */
/* ------------------------------------------------------------------ */

const main = async () => {
  let filenames;
  try {
    filenames = (await fs.readdir(FRIENDS_DIR)).filter((name) => name.endsWith('.json'));
  } catch (error) {
    logger.error('Failed to read friends directory', { dir: FRIENDS_DIR, error: formatError(error) });
    process.exit(1);
  }
  if (filenames.length === 0) {
    logger.info('No friend files found', { dir: FRIENDS_DIR });
    return;
  }

  const stats = {
    total: filenames.length,
    reachable: 0,
    unavailable: 0,
    newlyUnavailable: 0,
    recovered: 0,
    unchanged: 0,
    skipped: 0,
    changed: 0
  };
  const details = [];
  const changedFiles = [];

  await mapWithConcurrency(filenames, async (filename) => {
    const filePath = path.join(FRIENDS_DIR, filename);
    let raw;
    try {
      raw = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      logger.warn('Failed to read friend file, skipping', { file: filename, error: formatError(error) });
      stats.skipped += 1;
      return;
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      logger.warn('Invalid JSON in friend file, skipping', { file: filename, error: formatError(error) });
      stats.skipped += 1;
      return;
    }
    if (typeof data.url !== 'string' || data.url.trim() === '') {
      logger.warn('Friend file missing url, skipping', { file: filename });
      stats.skipped += 1;
      return;
    }

    const wasUnavailable = data.unavailable === true;
    const { reachable, detail } = await checkUrlReachable(data.url.trim());

    // 恢复机制（需求 3）：之前已失联、本次可访问 → 删除标记恢复为正常；
    // 新增失联（需求 1b）：正常 → 本次不可访问 → 写入标记。
    if (reachable && wasUnavailable) {
      delete data.unavailable;
      stats.recovered += 1;
      stats.changed += 1;
    } else if (!reachable && !wasUnavailable) {
      data.unavailable = true;
      stats.newlyUnavailable += 1;
      stats.changed += 1;
    } else if (!reachable) {
      stats.unavailable += 1;
    } else {
      stats.reachable += 1;
    }

    const statusLabel = reachable ? (wasUnavailable ? 'recovered' : 'ok') : (wasUnavailable ? 'unavailable' : 'newly-unavailable');
    details.push({ file: filename, name: data.name || '(未命名)', url: data.url, status: statusLabel, detail });

    if (statusLabel === 'recovered' || statusLabel === 'newly-unavailable') {
      // 保留原缩进与原字段顺序（JSON.parse 保持键序，unavailable 追加在末尾）。
      const serialized = `${JSON.stringify(data, null, detectIndent(raw))}${raw.endsWith('\n') ? '\n' : ''}`;
      if (serialized !== raw) {
        changedFiles.push(filePath);
        if (!DRY_RUN) {
          await fs.writeFile(filePath, serialized, 'utf8');
        }
      } else {
        stats.unchanged += 1;
        stats.changed -= 1;
        if (reachable) stats.recovered -= 1; else stats.newlyUnavailable -= 1;
      }
    } else {
      stats.unchanged += 1;
    }
  }, CHECK_CONCURRENCY);

  // 逐条输出检查结果（供 Actions 日志检索）。
  for (const item of details) {
    const line = `[${item.status}] ${item.name} ${item.url} — ${item.detail}`;
    if (item.status === 'ok' || item.status === 'recovered') {
      logger.info(line);
    } else {
      logger.warn(line);
    }
  }

  logger.summary({
    total: stats.total,
    reachable: stats.reachable,
    unavailable: stats.unavailable,
    newlyUnavailable: stats.newlyUnavailable,
    recovered: stats.recovered,
    unchanged: stats.unchanged,
    skipped: stats.skipped
  });
  logger.summaryTable('Friend Link Health Check', [
    { metric: 'total', value: stats.total },
    { metric: 'reachable', value: stats.reachable },
    { metric: 'unavailable (kept)', value: stats.unavailable },
    { metric: 'newly unavailable', value: stats.newlyUnavailable },
    { metric: 'recovered', value: stats.recovered },
    { metric: 'unchanged', value: stats.unchanged },
    { metric: 'skipped', value: stats.skipped }
  ]);

  if (changedFiles.length === 0) {
    logger.info('No friend link status changes', { dir: FRIENDS_DIR });
    return;
  }

  if (DRY_RUN) {
    logger.info('Dry run: no files written, no commit', { wouldChange: changedFiles.length });
    return;
  }
  if (NO_GIT) {
    logger.info('Files written; skipped git commit (FRIEND_LINK_CHECK_NO_GIT=1)', { changed: changedFiles.length });
    return;
  }

  const sha = await commitAndPush(changedFiles);
  logger.info('Pushed friend link status update', { changed: changedFiles.length, commit: sha ?? 'none' });
};

// 全局异常兜底：任何未捕获 rejection / 异常都结构化记录并以非零码退出。
installGlobalErrorHandlers(logger);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    logger.error('Fatal: friend link check failed', { error: formatError(error) });
    process.exit(1);
  });
}
