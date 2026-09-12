/** Feishu custom bot Webhook sender. */
import { fetchWithRetry, readResponseText, RetryableHttpError } from './http.mjs';
import { createActionLogger } from './gh-actions-logger.mjs';

const logger = createActionLogger('feishu-webhook');
const SAFE_BUDGET = 4000;
const TIMEOUT_MS = 15000;
const RETRIES = 2;

export const sanitizeFeishuWebhookUrlForLogs = (value) => {
  try {
    const url = new URL(String(value));
    return `${url.protocol}//${url.host}/***`;
  } catch {
    return '***';
  }
};

const ensureSafeLength = (text) =>
  text.length <= SAFE_BUDGET ? text : `${text.slice(0, SAFE_BUDGET)}\n\n…(消息过长，其余内容已省略)`;

export const sendFeishuWebhookMessage = async (text, { event = 'notification', title = 'D-blog 通知' } = {}) => {
  const url = process.env.FEISHU_WEBHOOK_URL;
  if (!url) {
    logger.warn('FEISHU_WEBHOOK_URL not configured; skipping notification');
    return null;
  }

  const content = ensureSafeLength(`[${title}]\n事件: ${event}\n\n${String(text ?? '')}`);
  const payload = { msg_type: 'text', content: { text: content } };
  let response;
  try {
    response = await fetchWithRetry(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      {
        timeoutMs: TIMEOUT_MS,
        retries: RETRIES,
        onRetry: ({ attempt, status, error, delayMs }) =>
          logger.warn('Feishu Webhook transient failure, retrying', {
            attempt,
            status: status ?? 'network',
            error: error ? error.message : '',
            delayMs,
          }),
      },
    );
  } catch (error) {
    const status = error instanceof RetryableHttpError ? error.status : 0;
    const attempts = error instanceof RetryableHttpError ? error.attempts : undefined;
    throw new Error(
      `Feishu Webhook request failed after ${attempts ?? '?'} attempt(s): ${sanitizeFeishuWebhookUrlForLogs(url)}` +
        (status ? ` (HTTP ${status})` : ' (network error)'),
      { cause: error },
    );
  }

  const body = await readResponseText(response, { maxBytes: 4096 }).catch(() => '');
  if (!response.ok) {
    throw new Error(
      `Feishu Webhook request failed: ${sanitizeFeishuWebhookUrlForLogs(url)} (HTTP ${response.status})` +
        (body ? ` — ${body.slice(0, 200)}` : ''),
    );
  }
  if (body) {
    try {
      const result = JSON.parse(body);
      if (result.code !== undefined && result.code !== 0) {
        throw new Error(`Feishu Webhook rejected message (code=${result.code}): ${String(result.msg || 'unknown')}`);
      }
    } catch (error) {
      if (error.message.startsWith('Feishu Webhook rejected message')) throw error;
    }
  }
  return { status: response.status };
};
