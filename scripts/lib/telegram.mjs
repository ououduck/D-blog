/**
 * Telegram Bot API 消息发送共享库（供 telegram-notify / check-broken-links 等脚本复用）。
 *
 * 配置（环境变量）：
 *   TELEGRAM_BOT_TOKEN（BotFather 获取）、TELEGRAM_CHAT_ID（接收 chat id）、
 *   TELEGRAM_TOPIC_ID（可选：论坛话题 id，设置后消息发往该话题）。
 *
 * 注意：Telegram 业务错误（chat 不存在、parse_mode 非法等）以 HTTP 200 + ok:false
 * 返回，必须检查 JSON 体而非只看 HTTP 状态码。
 */
import { fetchWithRetry, readResponseText, RetryableHttpError } from './http.mjs';
import { createActionLogger } from './gh-actions-logger.mjs';

const logger = createActionLogger('telegram');

/** 安全预算：HTML 标签也计长度，留余量避免踩线（Telegram 单条硬上限 4096 字符）。 */
const TELEGRAM_SAFE_BUDGET = 4000;
/** 单次发送超时（毫秒）。 */
const TELEGRAM_TIMEOUT_MS = 15000;
/** 发送重试次数（不含首次请求）。 */
const TELEGRAM_RETRIES = 2;

/** Telegram 常见业务错误码 → 排障提示。 */
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
 * 总长兜底截断：正常路径字段级截断后消息远低于上限，此处仅作防御；
 * 截断后清理末尾可能被切断的不完整标签 / HTML 实体，避免 Telegram 400。
 */
const ensureSafeLength = (text) => {
  if (text.length <= TELEGRAM_SAFE_BUDGET) return text;
  const cut = text.slice(0, TELEGRAM_SAFE_BUDGET);
  const cleaned = cut
    .replace(/<[^>]*$/, '')
    .replace(/&(?:amp|lt|gt|quot|#\d+)?;?$/, '')
    .replace(/&[a-zA-Z#0-9]*$/, '');
  return `${cleaned}\n\n…(消息过长，其余内容已省略)`;
};

/**
 * 调用 Telegram Bot API sendMessage 发送消息（HTML parse mode）。
 * 返回 Telegram 返回的 result（含 message_id）。
 * 配置缺失时返回 null（调用方按"未配置"处理）；发送失败抛错。
 */
export const sendTelegramMessage = async (text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    logger.warn('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured; skipping notification');
    return null;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: ensureSafeLength(text),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  // message_thread_id 必须为正整数：浮点值（如 "1.5"）会让 Telegram API 报错。
  const topicId = Number(process.env.TELEGRAM_TOPIC_ID);
  if (Number.isInteger(topicId) && topicId > 0) {
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
