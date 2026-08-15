// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeBackoffDelay, createTimeoutSignal } from './http.mjs';

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
