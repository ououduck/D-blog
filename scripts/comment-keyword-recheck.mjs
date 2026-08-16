/**
 * comment-keyword-recheck.mjs — 全量评论关键词复查（手动触发，配合 Pages CMS 按钮）。
 *
 * 与 comment-keyword-filter.mjs（事件触发，只检查新增内容）不同：
 * 本脚本遍历仓库内所有讨论（Discussions）下的全部评论，用当前
 * config/comment-keywords.json 的关键词/正则重新匹配一遍，
 * 对命中的评论执行配置的处理动作（minimize / delete / none）。
 *
 * 典型用途：修改关键词配置后，一键清理历史评论中遗漏的广告/引流内容；
 * 也可以作为「重新审查所有评论」的定期巡检手段。
 *
 * 触发方式：Pages CMS 侧边栏「🔍 重新审查全部评论」按钮（见 .pages.yml 的 actions 段），
 * 由 .github/workflows/comment-keyword-recheck.yml 以 workflow_dispatch 调用；
 * 也可在 GitHub Actions 页面手动 Run workflow。
 *
 * 设计原则（与 comment-keyword-filter.mjs 一致）：
 *   1. 配置缺失/为空/解析失败 → 优雅跳过（::warning:: + 正常退出），不红叉；
 *   2. 全部网络请求走 lib/http.mjs（超时 + 退避重试 + 限量读响应体）；
 *   3. GraphQL 失败仅告警不阻断整体流程，进度持续输出；
 *   4. 只审查「评论」，不触碰讨论（Discussion）本身 —— 站点留言板/文章评论区是
 *      站主自己的讨论，标题/正文不应被关键词规则删除；
 *   5. 已放行的评论不会因配置变更而反向恢复（不执行 unminimize），
 *      避免误撤销 Akismet 或人工处理的结果。
 *
 * 运行环境：GITHUB_TOKEN（自动注入）、GITHUB_REPOSITORY（自动注入，owner/repo）。
 */

import { fetchWithRetry, createTimeoutSignal, readResponseText } from './lib/http.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';
import { loadConfig, matchContent, isExemptAuthor } from './lib/keyword-filter-core.mjs';

const logger = createActionLogger('keyword-recheck');

/* ------------------------------------------------------------------ */
/* 常量                                                                 */
/* ------------------------------------------------------------------ */

const GRAPHQL_TIMEOUT_MS = 20000;
const GRAPHQL_RETRIES = 2;

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/** 列表分页防御上限（每页 100 条；个人博客远达不到，纯防御畸形响应死循环）。 */
const MAX_DISCUSSION_PAGES = 50;
const MAX_COMMENT_PAGES = 50;

/** 列表查询响应体读取上限（评论正文可能较大，给足余量）。 */
const LIST_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* GraphQL 查询与变更                                                   */
/* ------------------------------------------------------------------ */

const LIST_DISCUSSIONS_QUERY = `query ListDiscussions($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    discussions(first: 100, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes { id title url }
    }
  }
}`;

const DISCUSSION_COMMENTS_QUERY = `query DiscussionComments($id: ID!, $cursor: String) {
  node(id: $id) {
    ... on Discussion {
      comments(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          body
          url
          author { login }
          isMinimized
        }
      }
    }
  }
}`;

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

/**
 * 执行 GraphQL 请求（查询或变更统一入口）。
 * @param {string} query
 * @param {Record<string, unknown>} variables
 * @param {object} [options]
 * @param {number} [options.maxBytes] 响应体读取上限。
 * @returns {Promise<{ data: any } | null>} 成功返回数据，失败返回 null（已记录告警）。
 */
const graphql = async (query, variables, { maxBytes } = {}) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    logger.warn('GITHUB_TOKEN is not set; cannot query GitHub GraphQL');
    return null;
  }

  // 外层信号为总预算兜底（单次 20s × 3 次尝试 × 2 余量 = 120s），
  // 单次超时与重试由 fetchWithRetry 的 timeoutMs 管理（见 comment-keyword-filter 注释）。
  const { signal, cleanup } = createTimeoutSignal(GRAPHQL_TIMEOUT_MS * (GRAPHQL_RETRIES + 1) * 2);
  try {
    const response = await fetchWithRetry(
      GITHUB_GRAPHQL_URL,
      {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'D-blog Keyword Recheck Action/1.0',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ query, variables }),
      },
      {
        retries: GRAPHQL_RETRIES,
        timeoutMs: GRAPHQL_TIMEOUT_MS,
        signal,
        onRetry: (info) =>
          logger.warn('Retrying GraphQL request', {
            attempt: info.attempt,
            status: info.status ?? 'network',
            delayMs: info.delayMs,
          }),
      },
    );

    const raw = await readResponseText(response, { maxBytes: maxBytes ?? LIST_MAX_RESPONSE_BYTES });
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      logger.warn('GraphQL returned a non-JSON response', { status: response.status });
      return null;
    }

    if (!response.ok || result.errors) {
      // GraphQL 层错误（如权限不足、节点已被删除）：不重试，仅记录。
      // 节点已处理（Akismet 并行删除等）属预期情况，不视为失败。
      logger.warn('GraphQL request failed', {
        status: response.status,
        errors: result.errors || result.message || 'unknown',
      });
      return null;
    }
    return { data: result.data };
  } catch (error) {
    logger.warn('GraphQL request failed after retries', { error: formatError(error) });
    return null;
  } finally {
    cleanup();
  }
};

/* ------------------------------------------------------------------ */
/* 数据拉取                                                             */
/* ------------------------------------------------------------------ */

/**
 * 分页拉取仓库内全部讨论（仅 id/title/url，评论另行按需拉取）。
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ id: string, title: string, url: string }>>}
 */
const listAllDiscussions = async (owner, repo) => {
  const discussions = [];
  let cursor = null;
  let pages = 0;

  for (;;) {
    pages += 1;
    if (pages > MAX_DISCUSSION_PAGES) {
      logger.warn('Discussion pagination cap reached; stopping', { pages });
      break;
    }
    const result = await graphql(LIST_DISCUSSIONS_QUERY, { owner, repo, cursor });
    if (!result) break;

    const connection = result.data?.repository?.discussions;
    if (!connection) {
      logger.warn('No discussions connection in response', { owner, repo });
      break;
    }
    for (const node of connection.nodes ?? []) {
      if (node?.id && node?.title) {
        discussions.push({ id: node.id, title: node.title, url: node.url ?? 'unknown' });
      }
    }
    if (!connection.pageInfo?.hasNextPage || !connection.pageInfo?.endCursor) break;
    cursor = connection.pageInfo.endCursor;
  }

  return discussions;
};

/**
 * 分页拉取单个讨论下的全部评论。
 * @param {string} discussionId
 * @returns {Promise<Array<{ id: string, body: string, url: string, author: string, isMinimized: boolean }>>}
 */
const listDiscussionComments = async (discussionId) => {
  const comments = [];
  let cursor = null;
  let pages = 0;

  for (;;) {
    pages += 1;
    if (pages > MAX_COMMENT_PAGES) {
      logger.warn('Comment pagination cap reached; stopping', { discussionId, pages });
      break;
    }
    const result = await graphql(DISCUSSION_COMMENTS_QUERY, { id: discussionId, cursor });
    if (!result) break;

    const connection = result.data?.node?.comments;
    if (!connection) {
      logger.warn('No comments connection in response', { discussionId });
      break;
    }
    for (const node of connection.nodes ?? []) {
      if (node?.id) {
        comments.push({
          id: node.id,
          body: node.body ?? '',
          url: node.url ?? 'unknown',
          author: node.author?.login ?? '',
          isMinimized: node.isMinimized === true,
        });
      }
    }
    if (!connection.pageInfo?.hasNextPage || !connection.pageInfo?.endCursor) break;
    cursor = connection.pageInfo.endCursor;
  }

  return comments;
};

/**
 * 从环境变量解析仓库 owner/repo（GITHUB_REPOSITORY 为主，Pages CMS payload 兜底）。
 * @returns {{ owner: string, repo: string } | null}
 */
const getRepository = () => {
  const fromEnv = (process.env.GITHUB_REPOSITORY || '').split('/');
  if (fromEnv.length === 2 && fromEnv[0] && fromEnv[1]) {
    return { owner: fromEnv[0], repo: fromEnv[1] };
  }

  try {
    const payload = JSON.parse(process.env.PAGES_CMS_PAYLOAD || '');
    if (payload?.repository?.owner && payload?.repository?.repo) {
      return { owner: payload.repository.owner, repo: payload.repository.repo };
    }
  } catch {
    // payload 非法/缺失时忽略，交由下方统一报错。
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* 入口                                                                 */
/* ------------------------------------------------------------------ */

const main = async () => {
  const config = loadConfig(logger);
  if (!config) return;

  const repository = getRepository();
  if (!repository) {
    logger.error('Cannot determine owner/repo (GITHUB_REPOSITORY not set)');
    process.exitCode = 1;
    return;
  }
  const { owner, repo } = repository;

  logger.startGroup('Fetching all discussions');
  let discussions;
  try {
    discussions = await listAllDiscussions(owner, repo);
  } catch (error) {
    logger.error('Failed to list discussions', { error: formatError(error) });
    process.exitCode = 1;
    return;
  } finally {
    logger.endGroup();
  }
  logger.info('Discussions fetched', { count: discussions.length });

  if (discussions.length === 0) {
    logger.warn('No discussions found; nothing to recheck', { owner, repo });
    return;
  }

  let scanned = 0;
  let exemptCount = 0;
  let matched = 0;
  let actioned = 0;
  let failed = 0;
  const rows = [];

  for (const discussion of discussions) {
    const comments = await listDiscussionComments(discussion.id);
    logger.info('Discussion loaded', { title: discussion.title, comments: comments.length });

    for (const comment of comments) {
      scanned += 1;

      // 豁免：配置名单 + 机器人账号（giscus[bot] 公告等；仓库主不再自动豁免，按配置执行）。
      if (isExemptAuthor(comment.author, config.exemptUsers)) {
        exemptCount += 1;
        continue;
      }

      const hit = matchContent(config, comment.body);
      if (!hit) continue;
      matched += 1;

      const action = config.action;
      let ok = true;
      if (action === 'none') {
        logger.info('Action is "none"; matched comment only logged', { author: comment.author, url: comment.url });
      } else if (action === 'minimize') {
        ok =
          (await graphql(MINIMIZE_COMMENT_MUTATION, { subjectId: comment.id, reason: 'SPAM' }, { maxBytes: 65536 })) !==
          null;
      } else {
        ok = (await graphql(DELETE_COMMENT_MUTATION, { commentId: comment.id }, { maxBytes: 65536 })) !== null;
      }

      if (ok) {
        actioned += 1;
      } else {
        failed += 1;
      }
      rows.push({
        讨论: discussion.title,
        作者: comment.author || '-',
        命中: `${hit.type}:${hit.value}`,
        处理: ok ? action : '失败',
        链接: comment.url,
      });
      logger.warn('Matched comment processed', {
        author: comment.author,
        type: hit.type,
        value: hit.value,
        action: ok ? action : 'failed',
        url: comment.url,
      });

      if (scanned % 50 === 0) {
        logger.info('Progress', { scanned, matched, actioned, failed });
      }
    }
  }

  logger.summaryTable('关键词全量复查结果', rows);
  logger.summary({
    scanned,
    exempt: exemptCount,
    matched,
    actioned,
    failed,
    discussions: discussions.length,
    action: config.action,
  });
};

// 全局异常兜底：任何未捕获 rejection / 异常都结构化记录并以非零码退出。
installGlobalErrorHandlers(logger);

main().catch((error) => {
  logger.error('Fatal: keyword recheck failed', { error: formatError(error) });
  process.exit(1);
});
