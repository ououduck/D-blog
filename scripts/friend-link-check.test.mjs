// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock 网络层：SSRF 校验与 fetch 均可控，避免真实 DNS/请求。
vi.mock('./lib/http.mjs', () => ({
  isSafePublicHttpUrl: vi.fn(async () => true),
  fetchWithRetry: vi.fn(async () => ({ status: 200, body: { cancel: async () => {} }, headers: new Headers() })),
  getSafeFetchAgent: vi.fn(async () => ({})),
  RetryableHttpError: class RetryableHttpError extends Error {
    constructor(message, status = 0, attempts = 1) {
      super(message);
      this.status = status;
      this.attempts = attempts;
    }
  },
  sleep: vi.fn(async () => {}),
  computeBackoffDelay: vi.fn(() => 0),
}));

import { isSafePublicHttpUrl, fetchWithRetry } from './lib/http.mjs';
import { checkUrlReachable } from './friend-link-check.mjs';

const mockResponse = (status, location) => {
  const headers = new Headers();
  if (location !== undefined) headers.set('location', location);
  return { status, body: { cancel: async () => {} }, headers };
};

beforeEach(() => {
  vi.clearAllMocks();
  isSafePublicHttpUrl.mockResolvedValue(true);
});

describe('checkUrlReachable — SSRF 防护', () => {
  it('非公开地址被拦截（fail-closed），不发请求', async () => {
    isSafePublicHttpUrl.mockResolvedValue(false);
    const result = await checkUrlReachable('https://127.0.0.1:8080/');
    expect(result.reachable).toBe(false);
    expect(result.detail).toContain('SSRF');
    expect(fetchWithRetry).not.toHaveBeenCalled();
  });

  it('重定向每一跳都重新做 SSRF 校验（拦截跳转绕过）', async () => {
    // 第一跳安全（放行），第二跳（内网）被拦截。
    isSafePublicHttpUrl.mockImplementation(async (url) => url === 'https://public.example.com/');
    fetchWithRetry.mockResolvedValueOnce(mockResponse(302, 'http://169.254.169.254/latest/meta-data/'));

    const result = await checkUrlReachable('https://public.example.com/');
    expect(result.reachable).toBe(false);
    expect(result.detail).toContain('SSRF');
    // 第二跳校验失败，不应再发起第二跳请求。
    expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    expect(isSafePublicHttpUrl).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data/');
  });

  it('重定向后最终状态码正常判定可达', async () => {
    fetchWithRetry.mockResolvedValueOnce(mockResponse(301, 'https://public.example.com/new'));
    fetchWithRetry.mockResolvedValueOnce(mockResponse(200));

    const result = await checkUrlReachable('https://public.example.com/');
    expect(result.reachable).toBe(true);
    expect(result.detail).toBe('HTTP 200');
    expect(fetchWithRetry).toHaveBeenCalledTimes(2);
  });

  it('重定向超过 MAX_REDIRECTS 判为不可达', async () => {
    // 无限 302 环：3 跳（MAX_REDIRECTS=3，for 循环共执行 4 轮）后放弃。
    fetchWithRetry.mockResolvedValue(mockResponse(302, 'https://public.example.com/loop'));
    const result = await checkUrlReachable('https://public.example.com/');
    expect(result.reachable).toBe(false);
    expect(result.detail).toContain('重定向');
  });

  it('重定向缺少 Location 判为不可达', async () => {
    fetchWithRetry.mockResolvedValueOnce(mockResponse(302));
    const result = await checkUrlReachable('https://public.example.com/');
    expect(result.reachable).toBe(false);
    expect(result.detail).toContain('Location');
  });

  it('非 HTTP(S) 协议直接拒绝', async () => {
    const result = await checkUrlReachable('ftp://example.com/file');
    expect(result.reachable).toBe(false);
    expect(result.detail).toContain('协议');
  });

  it('URL 非法直接拒绝', async () => {
    const result = await checkUrlReachable('not a url');
    expect(result.reachable).toBe(false);
    expect(result.detail).toContain('无效');
  });
});
