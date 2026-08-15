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
 *   - exemptUsers  豁免用户（giscus[bot] 等机器人自动豁免；仓库主如需豁免也在此列出）
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
import { fetchWithRetry, createTimeoutSignal, readResponseText } from './lib/http.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';
import { loadConfig, matchContent, isExemptAuthor } from './lib/keyword-filter-core.mjs';

const logger = createActionLogger('keyword');

/* ------------------------------------------------------------------ */
/* 常量                                                                 */
/* ------------------------------------------------------------------ */

const GRAPHQL_TIMEOUT_MS = 20000;
const GRAPHQL_RETRIES = 2;

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/* ------------------------------------------------------------------ */
/* 事件载荷读取                                                         */
/* ------------------------------------------------------------------ */

/**
 * 读取并校验 GitHub Actions 事件载荷。
 * @returns {{ eventName: string, subject: { kind: 'comment' | 'discussion', id: string, author: string, text: string, url: string } } | null}
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

  let subject = null;
  if (eventName === 'discussion_comment' && payload.comment) {
    subject = {
      kind: 'comment',
      id: payload.comment.node_id,
      author: payload.comment.user?.login || '',
      text: payload.comment.body || '',
      url: payload.comment.html_url || 'unknown',
    };
  } else if (eventName === 'discussion' && payload.discussion) {
    subject = {
      kind: 'discussion',
      id: payload.discussion.node_id,
      author: payload.discussion.user?.login || '',
      text: `${payload.discussion.title || ''}\n${payload.discussion.body || ''}`,
      url: payload.discussion.html_url || 'unknown',
    };
  }

  if (!subject || !subject.id || !subject.text) {
    logger.warn('Event payload does not contain checkable content; skipping', { eventName });
    return null;
  }

  return {
    eventName,
    subject,
  };
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
    const response = await fetchWithRetry(
      GITHUB_GRAPHQL_URL,
      {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'D-blog Keyword Filter Action/1.0',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ query, variables }),
      },
      {
        retries: GRAPHQL_RETRIES,
        signal,
        onRetry: (info) =>
          logger.warn('Retrying GraphQL request', {
            attempt: info.attempt,
            status: info.status ?? 'network',
            delayMs: info.delayMs,
          }),
      },
    );

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
        errors: result.errors || result.message || 'unknown',
      });
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    logger.warn('GraphQL request failed after retries; moderation action not applied', {
      error: formatError(error),
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
  const config = loadConfig(logger);
  if (!config) return;

  const event = loadEventPayload();
  if (!event) {
    logger.error('Skipping: could not load event payload');
    process.exitCode = 1;
    return;
  }
  const { subject } = event;

  // 豁免：配置名单 + 机器人账号（仓库主不再自动豁免，按配置执行）。
  if (isExemptAuthor(subject.author, config.exemptUsers)) {
    logger.info('Skipped: exempt user', { author: subject.author, kind: subject.kind });
    return;
  }

  const hit = matchContent(config, subject.text);
  logger.startGroup(`Keyword filter: @${subject.author || 'unknown'} (${subject.kind}, ${subject.url})`);
  try {
    if (!hit) {
      logger.info('No keyword matched; content left as is');
      logger.summaryTable('关键词过滤结果', [
        {
          类型: subject.kind,
          作者: subject.author || '-',
          目标: subject.url,
          结果: '放行',
        },
      ]);
      return;
    }

    // 评论与讨论使用各自的处理动作配置。
    const action = subject.kind === 'comment' ? config.action : config.discussionAction;
    logger.warn('Keyword matched; applying moderation action', {
      type: hit.type,
      value: hit.value,
      action,
      url: subject.url,
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

    logger.summaryTable('关键词过滤结果', [
      {
        类型: subject.kind,
        作者: subject.author || '-',
        目标: subject.url,
        命中: `${hit.type}:${hit.value}`,
        处理: ok ? action : '失败',
      },
    ]);
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
