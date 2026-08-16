// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeBackoffDelay, createTimeoutSignal, sanitizeUrlForLogs, isPrivateAddress } from './http.mjs';

describe('computeBackoffDelay', () => {
  it('第 1 次重试延迟在 [0, base×2) 内', () => {
    const delay = computeBackoffDelay(1, 1000, 60000);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThan(2000);
  });

  it('指数增长且封顶 maxDelay', () => {
    // attempt=10：2^10=1024 × base 远超 max，应封顶为 max（抖动后 < max）
    const delay = computeBackoffDelay(10, 1000, 5000);
    expect(delay).toBeLessThan(5000);
  });

  it('超长 attempt 钳制指数（不溢出）', () => {
    const delay = computeBackoffDelay(100, 1000, 60000);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThan(60000);
  });
});

describe('createTimeoutSignal', () => {
  it('超时后 signal 为 aborted', async () => {
    const { signal, cleanup } = createTimeoutSignal(10, undefined);
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(signal.aborted).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('外部信号提前 abort 时 signal 立即反映', () => {
    const external = new AbortController();
    external.abort(new Error('cancelled'));
    const { signal, cleanup } = createTimeoutSignal(10000, external.signal);
    try {
      expect(signal.aborted).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('cleanup 清除定时器（不误触 abort）', async () => {
    const { signal, cleanup } = createTimeoutSignal(20, undefined);
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(signal.aborted).toBe(false);
  });
});

describe('sanitizeUrlForLogs', () => {
  it('脱敏 Telegram bot token（路径段）', () => {
    expect(sanitizeUrlForLogs('https://api.telegram.org/bot123456:ABC-DEF_xyz/sendMessage')).toBe(
      'https://api.telegram.org/bot***/sendMessage',
    );
  });

  it('脱敏 Akismet key（子域）', () => {
    expect(sanitizeUrlForLogs('https://deadbeef123.rest.akismet.com/1.1/comment-check')).toBe(
      'https://***.rest.akismet.com/1.1/comment-check',
    );
  });

  it('脱敏 basic auth userinfo', () => {
    expect(sanitizeUrlForLogs('https://user:secret@api.example.com/v1')).toBe('https://***@api.example.com/v1');
  });

  it('普通 URL 原样保留', () => {
    expect(sanitizeUrlForLogs('https://api.github.com/repos/owner/repo/issues')).toBe(
      'https://api.github.com/repos/owner/repo/issues',
    );
  });
});

describe('isPrivateAddress', () => {
  it('识别常见私网段', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.1.2.3')).toBe(true);
    expect(isPrivateAddress('192.168.1.1')).toBe(true);
    expect(isPrivateAddress('172.16.0.1')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
  });

  it('放行公网地址', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('1.1.1.1')).toBe(false);
  });

  it('IPv4-mapped IPv6 私网地址解包后判定（::ffff:127.0.0.1）', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false);
  });

  it('IPv6 私网/回环识别', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('fc00::1')).toBe(true);
  });

  it('畸形地址 fail-closed 判定为私网', () => {
    expect(isPrivateAddress('999.999.999.999')).toBe(true);
    expect(isPrivateAddress('not-an-ip')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });
});
