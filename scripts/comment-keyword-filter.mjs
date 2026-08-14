/**
 * comment-keyword-filter.mjs — GitHub Discussion 评论/讨论关键词过滤（自建审核层）。
 *
 * 与 Akismet 检查互补：Akismet 基于内容特征判定，本脚本基于站主自定义关键词，
 * 用于拦截 Akismet 漏判的广告/引流类内容。
 *
 * 触发方式：GitHub Actions 事件，由 .github/workflows/comment-keyword-filter.yml 调用：
 *   - discussion_comment: created  → 检查评论正文（文章评论、留言板留言）；
 *   - discussion: created         → 检查新建讨论的标题+正文（防直接建讨论灌水）。
 *
 * 配置：config/comment-keywords.json
 *   - keywords[]   子串匹配（忽略大小写；正文先去除零宽字符再匹配）
 *   - patterns[]   正则匹配（大小写不敏感；非法正则跳过并告警）
 *   - action       评论命中后的处理：'minimize'（默认，折叠隐藏，可撤销）/ 'delete'（删除）/ 'none'（仅记录）
 *   - discussionAction  新建讨论命中后的处理：'delete'（默认）/ 'none'
 *   - exemptUsers  豁免用户（仓库主自动豁免，giscus[bot] 等机器人自动豁免）
 *
 * 设计原则（与 akismet-comment-check.mjs 一致）：
 *   1. 配置缺失/为空/解析失败 → 优雅跳过（::warning:: + 正常退出），不红叉；
 *   2. 所有网络请求走共享 lib（超时 + 退避重试 + 限量读响应体）；
 *   3. GraphQL 失败仅告警不阻断（宁可漏处理也不级联失败）；
 *   4. 结构化日志（::group:: 折叠 + ::warning:: 注解 + Job Summary）。
 *
 * 运行环境：GITHUB_TOKEN（自动注入）、GITHUB_EVENT_PATH（自动）、GITHUB_EVENT_NAME（自动）。
 */

import fs from 'node:fs';
import {
  fetchWithRetry,
  createTimeoutSignal,
  readResponseText
} from './lib/http.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';

const logger = createActionLogger('keyword');

/* ------------------------------------------------------------------ */
/* 常量                                                                 */
/* ------------------------------------------------------------------ */

const GRAPHQL_TIMEOUT_MS = 20000;
const GRAPHQL_RETRIES = 2;

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const CONFIG_PATH = 'config/comment-keywords.json';

/** 自动豁免的机器人账号（giscus 公告类讨论/评论不应被关键词审核）。 */
const ALWAYS_EXEMPT_USERS = new Set(['giscus[bot]', 'github-actions[bot]']);

/* ------------------------------------------------------------------ */
/* 配置加载                                                             */
/* ------------------------------------------------------------------ */

/**
 * 文本规范化：小写 + 去除零宽字符（防绕过） + 连续空白折叠为单空格。
 * @param {string | null | undefined} text
 * @returns {string}
 */
const normalizeText = (text) => String(text ?? '')
  .toLowerCase()
  .replace(/[\u200b-\u200f\ufeff]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * 加载并校验关键词配置。
 * @returns {null | { action: string, discussionAction: string, exemptUsers: Set<string>, keywords: string[], patterns: RegExp[] }}
 *          配置缺失/为空/解析失败时返回 null（调用方优雅跳过）。
 */
const loadConfig = () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    logger.warn('Keyword config file not found; filter skipped', { path: CONFIG_PATH });
    return null;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    logger.warn('Failed to parse keyword config; filter skipped', { path: CONFIG_PATH, error: formatError(error) });
    return null;
  }

  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());

  const patterns = [];
  for (const item of Array.isArray(raw.patterns) ? raw.patterns : []) {
    if (typeof item !== 'string' || !item.trim()) continue;
    try {
      patterns.push(new RegExp(item, 'i'));
    } catch (error) {
      // 单条正则非法只跳过该条，不拖垮整份配置。
      logger.warn('Invalid keyword regex pattern skipped', { pattern: item, error: formatError(error) });
    }
  }

  if (keywords.length === 0 && patterns.length === 0) {
    logger.warn('No keywords or patterns configured; filter skipped', { path: CONFIG_PATH });
    return null;
  }

  const exemptUsers = new Set(
    (Array.isArray(raw.exemptUsers) ? raw.exemptUsers : [])
      .filter((item) => typeof item === 'string')
      .map((item) => item.toLowerCase())
  );

  return {
    // 非法 action 值一律回退到安全默认（minimize 可撤销，杜绝误删）。
    action: raw.action === 'delete' ? 'delete' : raw.action === 'none' ? 'none' : 'minimize',
    discussionAction: raw.discussionAction === 'none' ? 'none' : 'delete',
    exemptUsers,
    keywords,
    patterns
  };
};

/* ------------------------------------------------------------------ */
/* 事件载荷读取                                                         */
/* ------------------------------------------------------------------ */

/**
 * 读取并校验 GitHub Actions 事件载荷。
 * @returns {{ eventName: string, subject: { kind: 'comment' | 'discussion', id: string, author: string, text: string, url: string }, owner: string } | null}
 */
const loadEventPayload = () => {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    logger.error('GITHUB_EVENT_PATH is not set; expected discussion_comment/discussion event');
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  } catch (error) {
    logger.error('Failed to read GITHUB_EVENT_PATH payload', { error: formatError(error) });
    return null;
  }

  const repository = payload.repository;
  let subject = null;
  if (eventName === 'discussion_comment' && payload.comment) {
    subject = {
      kind: 'comment',
      id: payload.comment.node_id,
      author: payload.comment.user?.login || '',
      text: payload.comment.body || '',
      url: payload.comment.html_url || 'unknown'
    };
  } else if (eventName === 'discussion' && payload.discussion) {
    subject = {
      kind: 'discussion',
      id: payload.discussion.node_id,
      author: payload.discussion.user?.login || '',
      text: `${payload.discussion.title || ''}\n${payload.discussion.body || ''}`,
      url: payload.discussion.html_url || 'unknown'
    };
  }

  if (!subject || !subject.id || !subject.text) {
    logger.warn('Event payload does not contain checkable content; skipping', { eventName });
    return null;
  }

  return {
    eventName,
    subject,
    owner: repository?.owner?.login?.toLowerCase() || ''
  };
};

/* ------------------------------------------------------------------ */
/* 关键词匹配                                                           */
/* ------------------------------------------------------------------ */

/**
 * 对正文执行关键词/正则匹配。
 * @param {{ keywords: string[], patterns: RegExp[] }} config
 * @param {string} text 原始正文。
 * @returns {null | { type: 'keyword' | 'pattern', value: string }}
 */
const matchContent = (config, text) => {
  const normalized = normalizeText(text);
  for (const keyword of config.keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      return { type: 'keyword', value: keyword };
    }
  }
  for (const pattern of config.patterns) {
    if (pattern.test(normalized)) {
      return { type: 'pattern', value: pattern.source };
    }
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* GraphQL 处理动作                                                     */
/* ------------------------------------------------------------------ */

const MINIMIZE_COMMENT_MUTATION = `mutation MinimizeComment($subjectId: ID!, $reason: ReportedContentClassifiers!) {
  minimizeComment(input: { subjectId: $subjectId, reason: $reason }) {
    minimizedComment {
      isMinimized
    }
  }
}`;

const DELETE_COMMENT_MUTATION = `mutation DeleteDiscussionComment($commentId: ID!) {
  deleteDiscussionComment(input: { id: $commentId }) {
    clientMutationId
  }
}`;

const DELETE_DISCUSSION_MUTATION = `mutation DeleteDiscussion($id: ID!) {
  deleteDiscussion(input: { id: $id }) {
    discussion {
      id
    }
  }
}`;

/**
 * 执行 GraphQL 变更（minimize / delete）。
 * @param {string} query
 * @param {Record<string, unknown>} variables
 * @returns {Promise<{ ok: boolean }>}
 */
const runGraphQL = async (query, variables) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    logger.warn('GITHUB_TOKEN is not set; cannot apply moderation action');
    return { ok: false };
  }

  const { signal, cleanup } = createTimeoutSignal(GRAPHQL_TIMEOUT_MS);
  try {
    const response = await fetchWithRetry(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'D-blog Keyword Filter Action/1.0',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({ query, variables })
    }, {
      retries: GRAPHQL_RETRIES,
      signal,
      onRetry: (info) => logger.warn('Retrying GraphQL request', {
        attempt: info.attempt,
        status: info.status ?? 'network',
        delayMs: info.delayMs
      })
    });

    const raw = await readResponseText(response, { maxBytes: 65536 });
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      logger.warn('GraphQL returned a non-JSON response', { status: response.status });
      return { ok: false };
    }

    if (!response.ok || result.errors) {
      // GraphQL 层错误（如权限不足、节点已被删除/最小化）：不重试，仅记录。
      // 节点已处理（Akismet 并行删除等）属预期情况，不视为失败。
      logger.warn('GraphQL mutation failed', {
        status: response.status,
        errors: result.errors || result.message || 'unknown'
      });
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    logger.warn('GraphQL request failed after retries; moderation action not applied', {
      error: formatError(error)
    });
    return { ok: false };
  } finally {
    cleanup();
  }
};

/* ------------------------------------------------------------------ */
/* 入口                                                                 */
/* ------------------------------------------------------------------ */

const main = async () => {
  const config = loadConfig();
  if (!config) return;

  const event = loadEventPayload();
  if (!event) {
    logger.error('Skipping: could not load event payload');
    process.exitCode = 1;
    return;
  }
  const { subject, owner } = event;

  // 豁免：仓库主（本人评论无论如何不审核）+ 配置名单 + 机器人账号。
  const authorLower = subject.author.toLowerCase();
  if ((owner && authorLower === owner) || config.exemptUsers.has(authorLower) || ALWAYS_EXEMPT_USERS.has(authorLower)) {
    logger.info('Skipped: exempt user', { author: subject.author, kind: subject.kind });
    return;
  }

  const hit = matchContent(config, subject.text);
  logger.startGroup(`Keyword filter: @${subject.author || 'unknown'} (${subject.kind}, ${subject.url})`);
  try {
    if (!hit) {
      logger.info('No keyword matched; content left as is');
      logger.summaryTable('关键词过滤结果', [{
        类型: subject.kind,
        作者: subject.author || '-',
        目标: subject.url,
        结果: '放行'
      }]);
      return;
    }

    // 评论与讨论使用各自的处理动作配置。
    const action = subject.kind === 'comment' ? config.action : config.discussionAction;
    logger.warn('Keyword matched; applying moderation action', {
      type: hit.type,
      value: hit.value,
      action,
      url: subject.url
    });

    let ok = true;
    if (action === 'none') {
      logger.info('Action is "none"; matched content only logged');
    } else if (subject.kind === 'comment' && action === 'minimize') {
      ok = (await runGraphQL(MINIMIZE_COMMENT_MUTATION, { subjectId: subject.id, reason: 'SPAM' })).ok;
    } else if (subject.kind === 'comment' && action === 'delete') {
      ok = (await runGraphQL(DELETE_COMMENT_MUTATION, { commentId: subject.id })).ok;
    } else {
      // 新建讨论：不支持 minimize（讨论无折叠语义），一律 delete / none。
      ok = (await runGraphQL(DELETE_DISCUSSION_MUTATION, { id: subject.id })).ok;
    }

    logger.summaryTable('关键词过滤结果', [{
      类型: subject.kind,
      作者: subject.author || '-',
      目标: subject.url,
      命中: `${hit.type}:${hit.value}`,
      处理: ok ? action : '失败'
    }]);
  } finally {
    logger.endGroup();
  }
};

// 全局异常兜底：任何未捕获 rejection / 异常都结构化记录并以非零码退出。
installGlobalErrorHandlers(logger);

main().catch((error) => {
  logger.error('Fatal: keyword filter failed', { error: formatError(error) });
  process.exit(1);
});
