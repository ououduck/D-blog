/**
 * akismet-comment-check.mjs — GitHub Discussion 评论垃圾检查（Akismet 集成）。
 *
 * 触发方式：GitHub Actions `discussion_comment: created` 事件，由
 * .github/workflows/akismet-discussion-comment-check.yml 调用本脚本。
 *
 * 本版本为深度 Code Audit + 防御性重构最终版（Phase 3 全量重写，Phase 4 红队修正）：
 *
 * 1. 【verdict 状态区分】Akismet 响应不是简单 'true'/'false'：
 *    - 'true'  → 垃圾（删除评论）；
 *    - 'false' → 正常评论（放行）；
 *    - 其他（'invalid'、'Internal Server Error'、HTTP 500 页正文等）→
 *      无法判定。此时按"放行但显著告警"处理（宁可漏删不误删），
 *      绝不把服务端错误误报为 legitimate（上版把 500 页正文当 'false' 处理，
 *      日志误导排障方向）。
 * 2. 【HTTP 状态前置检查】Akismet 非 2xx 响应不读取 verdict，直接按
 *    无法判定处理并告警。
 * 3. 【响应体限量读取】Akismet 响应体经 readResponseText 限量读取
 *    （Akismet 正常响应 < 32B，但服务端错误页可能数 KB），防极端响应
 *    拖垮内存。
 * 4. 【删除评论的重试与幂等】GraphQL 删除失败仅警告不阻断
 *    （防误删后的级联失败）；node_id 缺失时跳过删除。
 * 5. 【结构化日志】::group:: 折叠单次检查、::warning::/::error:: 注解、
 *    Job Summary 输出检查结果。
 *
 * 运行环境：GITHUB_TOKEN（自动）、AKISMET_API_KEY（可选）、GITHUB_EVENT_PATH（自动）。
 */

import fs from 'node:fs';
import { fetchWithRetry, createTimeoutSignal, readResponseText, RetryableHttpError } from './lib/http.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';

const logger = createActionLogger('akismet');

/* ------------------------------------------------------------------ */
/* 常量                                                                 */
/* ------------------------------------------------------------------ */

const AKISMET_TIMEOUT_MS = 15000;
const GRAPHQL_TIMEOUT_MS = 20000;
const AKISMET_RETRIES = 3;
const GRAPHQL_RETRIES = 2;

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

/** Akismet 判定的三种结论。'undetermined' 表示服务错误/畸形响应（不误删）。 */
const AKISMET_VERDICTS = Object.freeze({
  SPAM: 'spam',
  HAM: 'ham',
  UNDETERMINED: 'undetermined',
});

/** 非法字符裁剪：Akismet 对部分控制字符敏感，提交前净化。 */
const sanitizeForAkismet = (value) =>
  String(value ?? '')
    // eslint-disable-next-line no-control-regex -- 有意剔除 Akismet 敏感的控制字符
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 100000); // Akismet 单字段建议上限，防超大正文拒绝服务。

/* ------------------------------------------------------------------ */
/* 事件载荷读取（GITHUB_EVENT_PATH 为 Actions 自动写入的 JSON 文件）    */
/* ------------------------------------------------------------------ */

/**
 * 读取并校验 GitHub Actions 事件载荷。
 * @returns {{ fatal: boolean, comment?: Record<string, any>, discussion?: Record<string, any>, repository?: Record<string, any> }}
 *          fatal:true 表示载荷不可读（调用方应红叉）；fatal:false 且无数据表示事件不适用（良性跳过）。
 */
const loadEventPayload = () => {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    logger.error('GITHUB_EVENT_PATH is not set; expected discussion_comment event');
    return { fatal: true };
  }
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  } catch (error) {
    logger.error('Failed to read GITHUB_EVENT_PATH payload', { error: formatError(error) });
    return { fatal: true };
  }

  const comment = payload.comment;
  const discussion = payload.discussion;
  const repository = payload.repository;
  if (!comment || !discussion || !repository) {
    logger.warn('Event payload does not contain discussion_comment data; skipping');
    // 良性跳过（事件类型不适用），fatal:false 让调用方正常退出，避免无谓红叉。
    return { fatal: false };
  }
  return { fatal: false, comment, discussion, repository };
};

/* ------------------------------------------------------------------ */
/* Akismet 评论检查                                                     */
/* ------------------------------------------------------------------ */

/**
 * 调用 Akismet comment-check API。
 * @param {object} input Akismet 参数字段。
 * @returns {Promise<{ verdict: string, raw: string, status: number }>}
 *          verdict ∈ AKISMET_VERDICTS；raw 为原始响应体；status 为 HTTP 状态码。
 * @throws {Error} 请求彻底失败（重试耗尽）时抛出（由调用方按"无法判定"降级）。
 */
const checkWithAkismet = async (input) => {
  const apiKey = process.env.AKISMET_API_KEY;
  const params = new URLSearchParams(input);

  const { signal, cleanup } = createTimeoutSignal(AKISMET_TIMEOUT_MS);
  try {
    const response = await fetchWithRetry(
      `https://${apiKey}.rest.akismet.com/1.1/comment-check`,
      {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'D-blog Akismet Action/2.0',
        },
        body: params,
      },
      {
        retries: AKISMET_RETRIES,
        signal,
        onRetry: (info) =>
          logger.warn('Retrying Akismet request', {
            attempt: info.attempt,
            status: info.status ?? 'network',
            delayMs: info.delayMs,
          }),
      },
    );

    // Phase 4 修复：先检查 HTTP 状态。Akismet 5xx（服务端故障/过载）时
    // 响应体是错误页而非 verdict —— 按"无法判定"处理，不误读为 legitimate。
    if (!response.ok) {
      const raw = await readResponseText(response, { maxBytes: 4096 });
      return { verdict: AKISMET_VERDICTS.UNDETERMINED, raw, status: response.status };
    }

    // 正常响应体：'true'（垃圾）/'false'（正常）/ 其他（invalid 等）。
    const raw = (await readResponseText(response, { maxBytes: 4096 })).trim();
    if (raw === 'true') {
      return { verdict: AKISMET_VERDICTS.SPAM, raw, status: response.status };
    }
    if (raw === 'false') {
      return { verdict: AKISMET_VERDICTS.HAM, raw, status: response.status };
    }
    // 未知 verdict（Akismet 返回 invalid 等业务错误码）：无法判定，放行 + 告警。
    logger.warn('Akismet returned an unrecognized verdict; treating as undetermined', {
      status: response.status,
      raw: raw.slice(0, 200),
    });
    return { verdict: AKISMET_VERDICTS.UNDETERMINED, raw, status: response.status };
  } finally {
    cleanup();
  }
};

/* ------------------------------------------------------------------ */
/* GraphQL 删除 Discussion 评论                                        */
/* ------------------------------------------------------------------ */

const DELETE_COMMENT_MUTATION = `mutation DeleteDiscussionComment($commentId: ID!) {
  deleteDiscussionComment(input: { id: $commentId }) {
    clientMutationId
  }
}`;

/**
 * 通过 GraphQL 删除被判定为垃圾的评论。
 * @param {string} commentNodeId GitHub 节点 ID（comment.node_id）。
 * @returns {Promise<void>}
 */
const deleteDiscussionComment = async (commentNodeId) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    logger.error('GITHUB_TOKEN is not set; cannot delete spam comment');
    return;
  }
  if (!commentNodeId) {
    logger.warn('comment.node_id is missing; cannot delete spam comment');
    return;
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
          'User-Agent': 'D-blog Akismet Action/2.0',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          query: DELETE_COMMENT_MUTATION,
          variables: { commentId: commentNodeId },
        }),
      },
      {
        retries: GRAPHQL_RETRIES,
        signal,
        onRetry: (info) =>
          logger.warn('Retrying GraphQL delete', {
            attempt: info.attempt,
            status: info.status ?? 'network',
            delayMs: info.delayMs,
          }),
      },
    );

    // 响应体限量读取后解析（防 GraphQL 错误页为超大 HTML 时 JSON.parse 崩溃）。
    const raw = await readResponseText(response, { maxBytes: 65536 });
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      logger.warn('GraphQL delete returned a non-JSON response', { status: response.status });
      return;
    }

    if (!response.ok || result.errors) {
      // GraphQL 层错误（如权限不足、节点不存在）：不重试，仅记录。
      logger.warn('GraphQL delete failed', {
        status: response.status,
        errors: result.errors || result.message || 'unknown',
      });
      return;
    }
    logger.info('Spam comment deleted via GraphQL', { commentId: commentNodeId });
  } catch (error) {
    logger.warn('Failed to delete spam comment (will remain visible)', {
      error: formatError(error),
    });
  } finally {
    cleanup();
  }
};

/* ------------------------------------------------------------------ */
/* 入口                                                                 */
/* ------------------------------------------------------------------ */

const main = async () => {
  // 优雅降级：AKISMET_API_KEY 未配置时跳过（首次 Setup 场景）。
  // 输出 ::warning:: 并正常退出 —— 评论创建成功不等于检查失败，
  // 避免每次评论都让 workflow 显示红叉；站主补配 secret 后自动恢复。
  if (!process.env.AKISMET_API_KEY) {
    logger.warn('AKISMET_API_KEY is not configured; spam checking is skipped. Add the secret to restore protection.');
    return;
  }

  const event = loadEventPayload();
  if (!event || event.fatal) {
    // 仅载荷真正不可读（配置/环境错误）时红叉；事件不适用时 loadEventPayload
    // 已 warn 并返回 fatal:false，此处正常退出。
    if (event?.fatal) {
      process.exitCode = 1;
    }
    return;
  }
  const { comment, discussion, repository } = event;

  const commentAuthor = sanitizeForAkismet(comment.user?.login);
  const commentBody = sanitizeForAkismet(comment.body);

  logger.startGroup(`Akismet check: @${commentAuthor || 'unknown'} (${discussion.html_url || 'discussion'})`);
  try {
    const result = await checkWithAkismet({
      blog: repository.html_url || '',
      // Actions runner 中评论者的真实 IP 不可见（GitHub 不转发），
      // 统一以保留地址占位；Akismet 主要依据内容与作者特征判定。
      user_ip: '127.0.0.1',
      user_agent: 'GitHubActionBot/2.0',
      referrer: discussion.html_url || '',
      comment_type: 'comment',
      comment_author: commentAuthor,
      comment_author_url: comment.user?.html_url || '',
      comment_content: commentBody,
    });

    if (result.verdict === AKISMET_VERDICTS.HAM) {
      logger.info('Akismet marked the comment as legitimate', {
        status: result.status,
        verdict: result.raw,
      });
      return;
    }

    if (result.verdict === AKISMET_VERDICTS.UNDETERMINED) {
      // 服务错误 / 畸形 verdict：按"放行"处理（不误删），但显著告警，
      // 方便站主排查 Akismet 侧故障（配额耗尽、key 失效、服务中断）。
      logger.error('Akismet check was inconclusive; comment left visible', {
        status: result.status,
        raw: result.raw.slice(0, 300),
      });
      return;
    }

    logger.warn('Akismet marked the comment as spam; deleting', {
      comment: comment.html_url || 'unknown',
      status: result.status,
    });
    await deleteDiscussionComment(comment.node_id);
  } catch (error) {
    // 请求彻底失败（重试耗尽）：无法判定，放行 + 告警（不误删）。
    logger.error('Akismet check failed after retries; comment left visible', {
      error: formatError(error),
      retryable: error instanceof RetryableHttpError,
    });
  } finally {
    logger.endGroup();
  }
};

// 全局异常兜底：任何未捕获 rejection / 异常都结构化记录并以非零码退出。
installGlobalErrorHandlers(logger);

main().catch((error) => {
  logger.error('Fatal: akismet check failed', { error: formatError(error) });
  process.exit(1);
});
