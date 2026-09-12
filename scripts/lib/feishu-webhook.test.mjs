// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeFeishuWebhookUrlForLogs, sendFeishuWebhookMessage } from './feishu-webhook.mjs';

const originalUrl = process.env.FEISHU_WEBHOOK_URL;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalUrl === undefined) delete process.env.FEISHU_WEBHOOK_URL;
  else process.env.FEISHU_WEBHOOK_URL = originalUrl;
});

describe('sanitizeFeishuWebhookUrlForLogs', () => {
  it('hides webhook path and query secrets', () => {
    expect(sanitizeFeishuWebhookUrlForLogs('https://open.feishu.cn/hook/secret?key=value')).toBe(
      'https://open.feishu.cn/***',
    );
  });

  it('fails closed for malformed URLs', () => {
    expect(sanitizeFeishuWebhookUrlForLogs('not a url')).toBe('***');
  });
});

describe('sendFeishuWebhookMessage', () => {
  it('skips without configuration', async () => {
    delete process.env.FEISHU_WEBHOOK_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendFeishuWebhookMessage('消息')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the Feishu text payload', async () => {
    process.env.FEISHU_WEBHOOK_URL = 'https://example.com/hook/secret';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendFeishuWebhookMessage('消息', { event: 'push', title: '标题' })).resolves.toEqual({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      msg_type: 'text',
      content: { text: '[标题]\n事件: push\n\n消息' },
    });
  });

  it('truncates oversized messages within the safe budget', async () => {
    process.env.FEISHU_WEBHOOK_URL = 'https://example.com/hook';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 0 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendFeishuWebhookMessage('x'.repeat(5000));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.content.text.length).toBeLessThanOrEqual(4050);
    expect(payload.content.text).toContain('消息过长');
  });

  it('rejects Feishu business errors even on HTTP 200', async () => {
    process.env.FEISHU_WEBHOOK_URL = 'https://example.com/hook/secret';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ code: 19001, msg: 'invalid signature' }), { status: 200 })),
    );
    await expect(sendFeishuWebhookMessage('消息')).rejects.toThrow(/code=19001/);
  });

  it('reports HTTP failures without webhook secrets', async () => {
    process.env.FEISHU_WEBHOOK_URL = 'https://example.com/hook/secret?key=value';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));
    await expect(sendFeishuWebhookMessage('消息')).rejects.toThrow('https://example.com/*** (HTTP 400)');
  });
});
