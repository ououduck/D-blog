// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  computeBackoffDelay,
  createTimeoutSignal,
  sanitizeUrlForLogs,
  isPrivateAddress,
  isResolvedAddressesSafe,
  getSafeFetchAgent,
  getSafeUndiciFetch,
} from './http.mjs';

/** 沿 cause 链查找错误码（undici 会把连接错误层层包装）。 */
const findErrorCode = (error, code) => {
  let current = error;
  while (current) {
    if (current.code === code) return true;
    if (Array.isArray(current.errors) && current.errors.some((e) => findErrorCode(e, code))) return true;
    current = current.cause;
  }
  return false;
};

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

describe('isResolvedAddressesSafe', () => {
  it('全部公网地址 → 安全', () => {
    expect(isResolvedAddressesSafe([{ address: '8.8.8.8' }, { address: '1.1.1.1' }])).toBe(true);
  });

  it('任一私网地址 → 不安全', () => {
    expect(isResolvedAddressesSafe([{ address: '8.8.8.8' }, { address: '127.0.0.1' }])).toBe(false);
    expect(isResolvedAddressesSafe([{ address: '10.0.0.1' }])).toBe(false);
    expect(isResolvedAddressesSafe([{ address: '::1' }])).toBe(false);
  });

  it('IPv4 代理伪 DNS 段（198.18.0.0/15）自动识别放行（Clash/Surge TUN 指纹）', () => {
    expect(isResolvedAddressesSafe([{ address: '198.18.0.1' }])).toBe(true);
    expect(isResolvedAddressesSafe([{ address: '198.18.2.60' }])).toBe(true);
  });

  it('IPv6 ULA 代理伪 DNS 段（fc00::/7）默认不放行（内网 IPv6 同样使用该段）', () => {
    expect(isResolvedAddressesSafe([{ address: 'fc00::1' }])).toBe(false);
  });

  it('混合代理伪 DNS 地址（198.18 + fc00）默认不放行，须显式开启', () => {
    expect(isResolvedAddressesSafe([{ address: '198.18.0.1' }, { address: 'fc00::1' }])).toBe(false);
  });

  it('公网与代理伪 DNS 地址混合时视为不安全（解析结果不可信）', () => {
    expect(isResolvedAddressesSafe([{ address: '8.8.8.8' }, { address: '198.18.0.1' }])).toBe(false);
  });

  it('ALLOW_PROXY_ARTIFACT_DNS=1 时显式放行全部代理伪 DNS 段（本地双栈 TUN 专用）', () => {
    process.env.ALLOW_PROXY_ARTIFACT_DNS = '1';
    try {
      expect(isResolvedAddressesSafe([{ address: '198.18.0.1' }])).toBe(true);
      expect(isResolvedAddressesSafe([{ address: 'fc00::1' }])).toBe(true);
      expect(isResolvedAddressesSafe([{ address: '198.18.0.1' }, { address: 'fc00::1' }])).toBe(true);
    } finally {
      delete process.env.ALLOW_PROXY_ARTIFACT_DNS;
    }
  });

  it('ALLOW_PROXY_ARTIFACT_DNS=0 时强制关闭自动识别（偏执部署/自建 Runner）', () => {
    process.env.ALLOW_PROXY_ARTIFACT_DNS = '0';
    try {
      expect(isResolvedAddressesSafe([{ address: '198.18.0.1' }])).toBe(false);
    } finally {
      delete process.env.ALLOW_PROXY_ARTIFACT_DNS;
    }
  });

  it('getSafeFetchAgent 懒加载并暴露连接期校验 dispatcher', async () => {
    // 单例：两次调用返回同一 Agent 实例。
    const agent = await getSafeFetchAgent();
    const agentAgain = await getSafeFetchAgent();
    expect(agent).toBeDefined();
    expect(agent).toBe(agentAgain);
    // 是 undici Agent（具备 dispatch 能力，可作 fetch dispatcher）。
    expect(typeof agent.dispatch).toBe('function');
  });

  it('getSafeUndiciFetch 返回 npm undici 的 fetch（缓存单例）', async () => {
    const undiciFetch = await getSafeUndiciFetch();
    expect(typeof undiciFetch).toBe('function');
    expect(await getSafeUndiciFetch()).toBe(undiciFetch);
  });

  it('连接期 SSRF 防护：safeLookup 拒绝私网解析（localhost → ERR_SSRF_BLOCKED）', async () => {
    // 通过真实 Agent + npm undici fetch 触发连接期 lookup：localhost 解析到
    // 127.0.0.1/::1（私网），应在建立 TCP 前被拒绝。端口须避开 undici 的保留端口
    // 列表（如 9），否则 URL 校验阶段就报 bad port；本测试不依赖外网。
    const agent = await getSafeFetchAgent();
    const undiciFetch = await getSafeUndiciFetch();
    try {
      await undiciFetch('http://localhost:65432/', { dispatcher: agent, signal: AbortSignal.timeout(5000) });
      expect.unreachable('私网目标应被连接期 SSRF 防护拒绝');
    } catch (error) {
      expect(findErrorCode(error, 'ERR_SSRF_BLOCKED')).toBe(true);
    }
  });
});
