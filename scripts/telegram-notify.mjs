/**
 * telegram-notify.mjs — GitHub 事件 → Telegram 推送（D-blog 项目消息提醒）。
 *
 * 由 .github/workflows/telegram-notify.yml 调用，把仓库事件实时推送到 Telegram：
 *   1. push (main)          → 推送更新（提交列表 + 对比链接）；
 *   2. discussion_comment   → 新评论（giscus 文章评论 / 留言板留言）；
 *   3. discussion           → 新讨论（防直接在 Discussions 灌水的可见性）；
 *   4. issues:opened        → 新 Issue（友链申请等）；
 *   5. workflow_run         → 任一 Action 运行完成的结果（成功/失败/取消…），
 *                            自动覆盖新增 workflow，无需维护白名单；
 *   6. workflow_dispatch    → 手动触发：发送测试消息验证配置。
 *
 * 设计要点：
 * 1. 【配置缺失优雅降级】TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 未配置时
 *    ::warning:: + 正常退出（与 akismet 的 AKISMET_API_KEY 缺失行为一致），
 *    不会让每次 push / 评论都红叉；配置后自动恢复推送。
 * 2. 【workflow_run 自触发防护】通知 workflow 自身运行完成同样会产生
 *    workflow_run 事件；脚本比对 event.workflow_run.name 与 GITHUB_WORKFLOW
 *    一致时跳过，避免"通知自己"的无限循环。
 * 3. 【HTML 注入防护】所有用户可控字段（评论正文、提交消息、Issue 标题等）
 *    经 escapeHtml 净化后再拼入消息体；字段级截断 + 总长兜底截断，
 *    满足 Telegram 4096 字符上限且不会在标签中间截断。
 * 4. 【发送失败可见】Telegram API 瞬时故障（5xx / 网络抖动）经 fetchWithRetry
 *    重试；重试耗尽或业务错误（HTTP 4xx / ok:false）→ ::error:: + 非零退出，
 *    让推送故障在 Actions 页面可见可查（配置缺失才静默）。
 * 5. 【结构化日志】沿用 lib/gh-actions-logger.mjs（::group:: / ::warning:: /
 *    ::error::），与其它自动化脚本一致。
 *
 * 运行环境（GitHub Actions 自动注入）：
 *   GITHUB_EVENT_NAME / GITHUB_EVENT_PATH / GITHUB_WORKFLOW / GITHUB_REPOSITORY
 * 可选配置（仓库 Secrets，Settings → Secrets and variables → Actions）：
 *   TELEGRAM_BOT_TOKEN（BotFather 获取）、TELEGRAM_CHAT_ID（接收 chat id）、
 *   TELEGRAM_TOPIC_ID（可选：论坛话题 id，设置后消息发往该话题）。
 *
 * 本地调试（只打印消息体，不发送）：
 *   GITHUB_EVENT_NAME=push GITHUB_EVENT_PATH=.trash/tg-test/push.json \
 *     node scripts/telegram-notify.mjs --print
 */

import fs from 'node:fs';
import { fetchWithRetry, readResponseText, RetryableHttpError } from './lib/http.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';

const logger = createActionLogger('telegram');

/* ------------------------------------------------------------------ */
/* 常量                                                                 */
/* ------------------------------------------------------------------ */

/** 安全预算：HTML 标签也计长度，留余量避免踩线（Telegram 单条硬上限 4096 字符）。 */
const TELEGRAM_SAFE_BUDGET = 4000;
/** 单次发送超时（毫秒）。 */
const TELEGRAM_TIMEOUT_MS = 15000;
/** 发送重试次数（不含首次请求）。 */
const TELEGRAM_RETRIES = 2;

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

/**
 * HTML 转义：所有用户可控字段进入消息体前必经此函数。
 * 同时净化双引号，保证插入 <a href="..."> 属性值安全。
 * @param {unknown} value
 * @returns {string}
 */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

  const lines = [`<b>🚀 D-blog 推送更新</b>`, ''];
  lines.push(`分支: <code>${escapeHtml(branch)}</code>`);
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
        `• <b>${escapeHtml(truncate(firstLine, MAX_COMMIT_MSG_CHARS))}</b> — ${escapeHtml(author)} (` +
          `<code>${escapeHtml(sha)}</code>)`,
      );
    }
    if (commits.length > MAX_COMMITS_LISTED) {
      lines.push(`• … 其余 ${commits.length - MAX_COMMITS_LISTED} 个提交省略`);
    }
  }

  if (compareUrl) {
    lines.push('', `<a href="${escapeHtml(compareUrl)}">查看提交对比</a>`);
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

  const lines = ['<b>💬 D-blog 新评论</b>', ''];
  lines.push(`位置: ${escapeHtml(truncate(title, MAX_TITLE_CHARS))}`);
  lines.push(`作者: ${escapeHtml(author)}`);
  if (body) lines.push(`评论: ${escapeHtml(body)}`);
  if (url) lines.push('', `<a href="${escapeHtml(url)}">查看评论</a>`);
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

  const lines = ['<b>💬 D-blog 新讨论</b>', ''];
  lines.push(`标题: ${escapeHtml(truncate(title, MAX_TITLE_CHARS))}`);
  lines.push(`作者: ${escapeHtml(author)}`);
  if (body) lines.push(`内容: ${escapeHtml(body)}`);
  if (url) lines.push('', `<a href="${escapeHtml(url)}">查看讨论</a>`);
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

  const lines = ['<b>📮 D-blog 新 Issue</b>', ''];
  lines.push(`标题: ${escapeHtml(truncate(title, MAX_TITLE_CHARS))}`);
  lines.push(`作者: ${escapeHtml(author)}`);
  if (body) lines.push(`内容: ${escapeHtml(body)}`);
  if (url) lines.push('', `<a href="${escapeHtml(url)}">查看 Issue</a>`);
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

  const lines = [`<b>⚙️ D-blog Action 完成</b>`, ''];
  lines.push(`工作流: ${escapeHtml(name)}${runNumber ? ` #${escapeHtml(String(runNumber))}` : ''}`);
  lines.push(`结果: ${escapeHtml(label)}`);
  lines.push(`分支: <code>${escapeHtml(branch)}</code>`);
  lines.push(`触发人: ${escapeHtml(actor)}`);
  if (displayTitle && displayTitle !== name) lines.push(`内容: ${escapeHtml(displayTitle)}`);
  if (durationText) lines.push(`耗时: ${escapeHtml(durationText)}`);
  if (run.html_url) lines.push('', `<a href="${escapeHtml(run.html_url)}">查看运行</a>`);
  return lines.join('\n');
};

/**
 * workflow_dispatch（手动触发）：发送测试消息，验证 Telegram 配置。
 * @param {Record<string, any>} event
 * @returns {string}
 */
const buildTestMessage = (event) => {
  const repo = repoName(event);
  const actor = event.sender?.login || 'manual';
  return [
    '<b>🔔 D-blog Telegram 通知测试</b>',
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

/**
 * 总长兜底截断：正常路径字段级截断后消息远低于上限，此处仅作防御；
 * 截断后清理末尾可能被切断的不完整标签 / HTML 实体，避免 Telegram 400。
 * @param {string} text
 * @returns {string}
 */
const ensureSafeLength = (text) => {
  if (text.length <= TELEGRAM_SAFE_BUDGET) return text;
  const cut = text.slice(0, TELEGRAM_SAFE_BUDGET);
  const cleaned = cut
    // 去掉末尾不完整的 <...>（如 "查看" 标签被切断）
    .replace(/<[^>]*$/, '')
    // 去掉末尾不完整的实体（如 "&amp" 缺分号）
    .replace(/&(?:amp|lt|gt|quot|#\d+)?;?$/, '')
    .replace(/&[a-zA-Z#0-9]*$/, '');
  return `${cleaned}\n\n…(消息过长，其余内容已省略)`;
};

/**
 * Telegram 常见业务错误码 → 排障提示。
 * 403（bot can't send messages to the bot / chat not found 等）多为
 * TELEGRAM_CHAT_ID 配置错误：getMe 返回的是「机器人自身 id」，不是你的 chat id；
 * 机器人之间无法互发消息，且机器人必须先被对方（或加入的群组）主动对话/添加过。
 */
const TELEGRAM_ERROR_HINTS = Object.freeze({
  401: 'Bot token 无效：检查 TELEGRAM_BOT_TOKEN 是否抄错或已被 BotFather 重置。',
  403:
    '机器人无权向该 chat 发消息：TELEGRAM_CHAT_ID 疑似指向机器人自身（getMe 的 id 是机器人不是你的 chat id），' +
    '或机器人从未加入该群组/频道。先用你自己的账号向机器人发一条消息，' +
    '再用 @userinfobot 或 getUpdates 确认 chat id（私聊为正数用户 id，群组为负数 id，频道用 @频道名）。',
  400:
    '请求参数错误：常见于 TELEGRAM_CHAT_ID 不存在（chat not found）、' +
    'TELEGRAM_TOPIC_ID 与消息线程不匹配、或消息内容超长。',
});

/** 把 Telegram 错误 JSON 转为带排障提示的报错文案。 */
const buildTelegramError = (json) => {
  const base = `Telegram API error: ${json.description || 'unknown'} (error_code=${json.error_code ?? '?'})`;
  const hint = TELEGRAM_ERROR_HINTS[json.error_code];
  return hint ? `${base} — ${hint}` : base;
};

/**
 * 调用 Telegram Bot API sendMessage 发送消息。
 * 注意：Telegram 业务错误（chat 不存在、parse_mode 非法等）以 HTTP 200 +
 * ok:false 返回，必须检查 JSON 体而非只看 HTTP 状态码。
 * @param {string} text 消息体（HTML parse mode）。
 * @returns {Promise<{ message_id?: number }>} Telegram 返回的 result。
 */
const sendTelegramMessage = async (text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: ensureSafeLength(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  const topicId = Number(process.env.TELEGRAM_TOPIC_ID);
  if (Number.isFinite(topicId) && topicId > 0) {
    payload.message_thread_id = topicId;
  }

  let response;
  try {
    response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      {
        timeoutMs: TELEGRAM_TIMEOUT_MS,
        retries: TELEGRAM_RETRIES,
        onRetry: ({ attempt, status, error, delayMs }) => {
          logger.warn('Telegram API transient failure, retrying', {
            attempt,
            status: status ?? 'network',
            error: error ? error.message : '',
            delayMs,
          });
        },
      },
    );
  } catch (error) {
    if (error instanceof RetryableHttpError) {
      logger.error('Telegram API request failed after retries', {
        status: error.status,
        attempts: error.attempts,
        body: error.body?.slice(0, 200),
      });
    }
    throw error;
  }

  const bodyText = await readResponseText(response, { maxBytes: 4096 });
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error(`Telegram API returned non-JSON response (HTTP ${response.status}): ${bodyText.slice(0, 200)}`);
  }
  if (json.ok !== true) {
    throw new Error(buildTelegramError(json));
  }
  return json.result || {};
};

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

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    // 配置缺失：优雅跳过（::warning:: + 正常退出），与 akismet 的降级策略一致。
    logger.warn('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured; skipping notification', { event: eventName });
    return 0;
  }

  const result = await sendTelegramMessage(message);
  logger.info('Telegram notification sent', {
    event: eventName,
    messageId: result.message_id ?? 'unknown',
  });
  return 0;
};

installGlobalErrorHandlers(logger);

try {
  process.exitCode = await main();
} catch (error) {
  // main 抛出的业务错误（事件解析失败 / 发送失败）已带上下文，统一记录。
  logger.error('telegram-notify failed', { error: formatError(error) });
  process.exitCode = 1;
}
