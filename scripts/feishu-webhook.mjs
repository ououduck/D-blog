/**
 * feishu-webhook.mjs — GitHub 事件 → 飞书机器人 Webhook 推送（D-blog 项目消息提醒）。
 *
 * 由 .github/workflows/feishu-webhook.yml 调用，把仓库事件实时推送到 飞书机器人 Webhook：
 *   1. push (main)          → 推送更新（提交列表 + 对比链接）；
 *   2. discussion_comment   → 新评论（giscus 文章评论 / 留言板留言）；
 *   3. discussion           → 新讨论（防直接在 Discussions 灌水的可见性）；
 *   4. issues:opened        → 新 Issue（友链申请等）；
 *   5. workflow_run         → 任一 Action 运行完成的结果（成功/失败/取消…），
 *                            自动覆盖新增 workflow，无需维护白名单；
 *   6. workflow_dispatch    → 手动触发：发送测试消息验证配置。
 *
 * 设计要点：
 * 1. 【配置缺失优雅降级】FEISHU_WEBHOOK_URL 未配置时
 *    ::warning:: + 正常退出（与 akismet 的 AKISMET_API_KEY 缺失行为一致），
 *    不会让每次 push / 评论都红叉；配置后自动恢复推送。
 * 2. 【workflow_run 自触发防护】通知 workflow 自身运行完成同样会产生
 *    workflow_run 事件；脚本比对 event.workflow_run.name 与 GITHUB_WORKFLOW
 *    一致时跳过，避免"通知自己"的无限循环。
 * 3. 【纯文本安全】所有用户可控字段（评论正文、提交消息、Issue 标题等）
 *    清理控制字符后再拼入消息体；字段级截断 + 总长兜底截断，满足飞书文本消息长度限制。
 * 4. 【发送失败可见】飞书机器人 Webhook API 瞬时故障（5xx / 网络抖动）经 fetchWithRetry
 *    重试；重试耗尽或业务错误（HTTP 4xx / ok:false）→ ::error:: + 非零退出，
 *    让推送故障在 Actions 页面可见可查（配置缺失才静默）。
 * 5. 【结构化日志】沿用 lib/gh-actions-logger.mjs（::group:: / ::warning:: /
 *    ::error::），与其它自动化脚本一致。
 *
 * 运行环境（GitHub Actions 自动注入）：
 *   GITHUB_EVENT_NAME / GITHUB_EVENT_PATH / GITHUB_WORKFLOW / GITHUB_REPOSITORY
 * 可选配置（仓库 Secrets，Settings → Secrets and variables → Actions）：
 *   FEISHU_WEBHOOK_URL（接收通知的 飞书机器人 Webhook 地址）。
 *
 * 本地调试（只打印消息体，不发送；GITHUB_EVENT_PATH 指向任意手动构造的
 * GitHub 事件 JSON 文件，如 path/to/push-event.json）：
 *   GITHUB_EVENT_NAME=push GITHUB_EVENT_PATH=path/to/push-event.json \
 *     node scripts/feishu-webhook.mjs --print
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { sendFeishuWebhookMessage } from './lib/feishu-webhook.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';

const logger = createActionLogger('feishu-webhook');

/* ------------------------------------------------------------------ */
/* 常量                                                                 */
/* ------------------------------------------------------------------ */

/** 单个 commit 消息预览上限（字符）。 */
const MAX_COMMIT_MSG_CHARS = 100;
/** 消息中最多列出的 commit 数（其余折叠为一行提示）。 */
const MAX_COMMITS_LISTED = 8;
/** 评论/讨论/Issue 正文预览上限（字符）。 */
const MAX_BODY_PREVIEW_CHARS = 300;
/** 标题类字段上限（字符）。 */
const MAX_TITLE_CHARS = 120;

/** workflow_run 结论 → 展示文案（未知结论回退原文）。 */
const CONCLUSION_LABELS = Object.freeze({
  success: '✅ 成功',
  failure: '❌ 失败',
  cancelled: '⏹ 已取消',
  timed_out: '⏱ 超时',
  action_required: '🔔 需要处理',
  neutral: '➖ 中性',
  skipped: '⏭ 已跳过',
  stale: '🕓 已过期',
});

/* ------------------------------------------------------------------ */
/* 工具函数                                                             */
/* ------------------------------------------------------------------ */

/** 将用户可控字段转换为纯文本，避免控制字符污染通知内容。 */
const CONTROL_CHARACTERS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  'g',
);
const escapeHtml = (value) => String(value ?? '').replace(CONTROL_CHARACTERS, ' ');

/** 折叠为单行（换行/连续空白 → 单个空格），用于预览行，防消息体被撑破。 */
const oneLine = (value) =>
  String(value ?? '')
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** 字段级截断（在转义之前对纯文本截断，不会切断 HTML 实体/标签）。 */
const truncate = (value, maxChars, suffix = '…') => {
  const text = String(value ?? '');
  if (text.length <= maxChars) return text;
  const budget = Math.max(0, maxChars - suffix.length);
  return `${text.slice(0, budget)}${suffix}`;
};

/**
 * 读取并解析 GitHub Actions 事件载荷。
 * @returns {{ eventName: string, event: Record<string, any> }}
 */
const loadEvent = () => {
  const eventName = process.env.GITHUB_EVENT_NAME;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventName) {
    throw new Error(
      'GITHUB_EVENT_NAME is not set (run inside GitHub Actions, or set it manually for local --print debugging).',
    );
  }
  if (!eventPath || !fs.existsSync(eventPath)) {
    throw new Error(`GITHUB_EVENT_PATH not found: ${eventPath || '(empty)'}`);
  }
  let event;
  try {
    event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse event payload ${eventPath}: ${error.message}`);
  }
  return { eventName, event };
};

/** 仓库全名（owner/repo），各事件载荷字段不一致时统一取数。 */
const repoName = (event) => event.repository?.full_name || process.env.GITHUB_REPOSITORY || 'GitHub';

/* ------------------------------------------------------------------ */
/* 各事件消息构建器（返回消息文本；返回 null 表示该事件应跳过不发送）      */
/* ------------------------------------------------------------------ */

/**
 * push（main 分支）：提交列表 + 对比链接。
 * @param {Record<string, any>} event
 * @returns {string}
 */
const buildPushMessage = (event) => {
  const branch = String(event.ref || '').replace(/^refs\/heads\//, '') || 'main';
  const commits = Array.isArray(event.commits) ? event.commits : [];
  const pusher = event.pusher?.name || event.sender?.login || 'unknown';
  const compareUrl = event.compare || event.head_commit?.url;

  const lines = [`🚀 D-blog 推送更新`, ''];
  lines.push(`分支: ${escapeHtml(branch)}`);
  lines.push(`提交: ${commits.length} 个 · 推送人: ${escapeHtml(pusher)}`);

  if (commits.length > 0) {
    lines.push('');
    for (const commit of commits.slice(0, MAX_COMMITS_LISTED)) {
      const sha = String(commit.id || '').slice(0, 7);
      const author = commit.author?.username || commit.author?.name || pusher;
      // 先取第一行再折叠空白：oneLine 会把换行折叠为空格，
      // 顺序颠倒会让"第二行及之后"误并入第一行预览。
      const rawFirstLine = String(commit.message ?? '').split(/\r?\n/)[0] || '';
      const firstLine = oneLine(rawFirstLine) || '(无提交信息)';
      lines.push(
        `• ${escapeHtml(truncate(firstLine, MAX_COMMIT_MSG_CHARS))} — ${escapeHtml(author)} (` + `${escapeHtml(sha)})`,
      );
    }
    if (commits.length > MAX_COMMITS_LISTED) {
      lines.push(`• … 其余 ${commits.length - MAX_COMMITS_LISTED} 个提交省略`);
    }
  }

  if (compareUrl) {
    lines.push('', `查看提交对比: ${compareUrl}`);
  }
  return lines.join('\n');
};

/**
 * discussion_comment（created）：giscus 文章评论 / 留言板留言。
 * @param {Record<string, any>} event
 * @returns {string}
 */
const buildCommentMessage = (event) => {
  const comment = event.comment || {};
  const discussion = event.discussion || {};
  const title = discussion.title || '(未知主题)';
  const author = comment.user?.login || event.sender?.login || 'unknown';
  const body = oneLine(truncate(comment.body, MAX_BODY_PREVIEW_CHARS));
  const url = comment.html_url || discussion.html_url;

  const lines = ['💬 D-blog 新评论', ''];
  lines.push(`位置: ${escapeHtml(truncate(title, MAX_TITLE_CHARS))}`);
  lines.push(`作者: ${escapeHtml(author)}`);
  if (body) lines.push(`评论: ${escapeHtml(body)}`);
  if (url) lines.push('', `查看评论: ${url}`);
  return lines.join('\n');
};

/**
 * discussion（created）：新建讨论（防灌水的可见性提醒）。
 * @param {Record<string, any>} event
 * @returns {string}
 */
const buildDiscussionMessage = (event) => {
  const discussion = event.discussion || {};
  const title = discussion.title || '(无标题)';
  const author = discussion.user?.login || event.sender?.login || 'unknown';
  const body = oneLine(truncate(discussion.body, MAX_BODY_PREVIEW_CHARS));
  const url = discussion.html_url;

  const lines = ['💬 D-blog 新讨论', ''];
  lines.push(`标题: ${escapeHtml(truncate(title, MAX_TITLE_CHARS))}`);
  lines.push(`作者: ${escapeHtml(author)}`);
  if (body) lines.push(`内容: ${escapeHtml(body)}`);
  if (url) lines.push('', `查看讨论: ${url}`);
  return lines.join('\n');
};

/**
 * issues（opened）：新 Issue（友链申请等）。
 * @param {Record<string, any>} event
 * @returns {string}
 */
const buildIssueMessage = (event) => {
  const issue = event.issue || {};
  const title = issue.title || '(无标题)';
  const author = issue.user?.login || event.sender?.login || 'unknown';
  const body = oneLine(truncate(issue.body, MAX_BODY_PREVIEW_CHARS));
  const url = issue.html_url;

  const lines = ['📮 D-blog 新 Issue', ''];
  lines.push(`标题: ${escapeHtml(truncate(title, MAX_TITLE_CHARS))}`);
  lines.push(`作者: ${escapeHtml(author)}`);
  if (body) lines.push(`内容: ${escapeHtml(body)}`);
  if (url) lines.push('', `查看 Issue: ${url}`);
  return lines.join('\n');
};

/**
 * workflow_run（completed）：任一 Action 运行完成的结果。
 * 自触发防护：workflow_run.name === GITHUB_WORKFLOW（即通知 workflow 自身）
 * 时返回 null 跳过，防止"通知自己"的无限循环。
 * @param {Record<string, any>} event
 * @returns {string | null}
 */
const buildWorkflowRunMessage = (event) => {
  const run = event.workflow_run || {};
  const selfWorkflow = process.env.GITHUB_WORKFLOW;
  if (run.name && selfWorkflow && run.name === selfWorkflow) {
    logger.debug('Skipping workflow_run for the notifier workflow itself', { name: run.name });
    return null;
  }

  const name = run.name || '(未知 workflow)';
  const runNumber = run.run_number || run.id || '';
  const conclusion = run.conclusion || run.status || 'unknown';
  const label = CONCLUSION_LABELS[conclusion] || String(conclusion);
  const branch = run.head_branch || 'main';
  const actor = run.actor?.login || event.sender?.login || 'unknown';
  const displayTitle = oneLine(truncate(run.display_title, MAX_TITLE_CHARS));

  // 耗时 = updated_at - created_at（秒级精度即可）。
  let durationText = '';
  if (run.created_at && run.updated_at) {
    const seconds = Math.max(0, Math.round((Date.parse(run.updated_at) - Date.parse(run.created_at)) / 1000));
    if (Number.isFinite(seconds)) {
      const minutes = Math.floor(seconds / 60);
      durationText = minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
    }
  }

  const lines = [`⚙️ D-blog Action 完成`, ''];
  lines.push(`工作流: ${escapeHtml(name)}${runNumber ? ` #${escapeHtml(String(runNumber))}` : ''}`);
  lines.push(`结果: ${escapeHtml(label)}`);
  lines.push(`分支: ${escapeHtml(branch)}`);
  lines.push(`触发人: ${escapeHtml(actor)}`);
  if (displayTitle && displayTitle !== name) lines.push(`内容: ${escapeHtml(displayTitle)}`);
  if (durationText) lines.push(`耗时: ${escapeHtml(durationText)}`);
  if (run.html_url) lines.push('', `查看运行: ${run.html_url}`);
  return lines.join('\n');
};

/**
 * workflow_dispatch（手动触发）：发送测试消息，验证 飞书机器人 Webhook 配置。
 * @param {Record<string, any>} event
 * @returns {string}
 */
const buildTestMessage = (event) => {
  const repo = repoName(event);
  const actor = event.sender?.login || 'manual';
  return [
    '🔔 D-blog 飞书机器人 Webhook 通知测试',
    '',
    `仓库: ${escapeHtml(repo)}`,
    `触发人: ${escapeHtml(actor)}`,
    '',
    '配置正常，消息推送成功 ✅',
  ].join('\n');
};

/** 事件名 → 构建器映射。 */
const BUILDERS = Object.freeze({
  push: buildPushMessage,
  discussion_comment: buildCommentMessage,
  discussion: buildDiscussionMessage,
  issues: buildIssueMessage,
  workflow_run: buildWorkflowRunMessage,
  workflow_dispatch: buildTestMessage,
});

/* ------------------------------------------------------------------ */
/* 发送                                                                 */
/* ------------------------------------------------------------------ */
// 消息发送复用 lib/feishu-webhook.mjs 的 sendFeishuWebhookMessage（含配置缺失优雅跳过、
// 字段级/总长截断、纯文本安全处理与错误提示）。本文件不再维护私有实现。

/* ------------------------------------------------------------------ */
/* 入口                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 主流程。
 * @returns {Promise<number>} 退出码。
 */
const main = async () => {
  const printOnly = process.argv.includes('--print');
  const { eventName, event } = loadEvent();

  const builder = BUILDERS[eventName];
  if (!builder) {
    // 其它事件（如 schedule / 未映射的 issue 类型）：不推送，正常退出。
    logger.debug('No message builder for event, skipping', { event: eventName });
    return 0;
  }

  const message = builder(event);
  if (message === null) {
    logger.info('Event skipped (no message)', { event: eventName });
    return 0;
  }

  if (printOnly) {
    // 本地调试：只打印消息体（含长度），不发送。
    const divider = '─'.repeat(64);
    console.log(`\n${divider}\n[event] ${eventName}\n${divider}\n${message}\n${divider}\n[chars] ${message.length}\n`);
    return 0;
  }

  const result = await sendFeishuWebhookMessage(message);
  if (result === null) {
    // 配置缺失：lib 内已 warning，优雅跳过（正常退出），与 akismet 的降级策略一致。
    return 0;
  }
  logger.info('飞书机器人 Webhook notification sent', { event: eventName, status: result.status });
  return 0;
};

installGlobalErrorHandlers(logger);

// 仅作为主模块直接运行时才执行：被测试/其他模块 import 时
// 不触发任何网络副作用（与 check-broken-links 的守卫一致）。
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  try {
    process.exitCode = await main();
  } catch (error) {
    // main 抛出的业务错误（事件解析失败 / 发送失败）已带上下文，统一记录。
    logger.error('feishu-webhook failed', { error: formatError(error) });
    process.exitCode = 1;
  }
}
