import { describe, it, expect, vi, afterEach } from 'vitest';
import { yieldToBrowser } from './yieldToBrowser';

describe('yieldToBrowser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolve 为 Promise 且让出到下一宏任务', async () => {
    const order: string[] = [];
    const promise = yieldToBrowser();
    // resolve 前同步代码已执行完（Promise 未立即 resolve）。
    order.push('before');
    await promise;
    order.push('after');
    expect(order).toEqual(['before', 'after']);
  });

  it('MessageChannel 不可用时回退 setTimeout', async () => {
    vi.stubGlobal('MessageChannel', undefined);
    const order: string[] = [];
    const promise = yieldToBrowser();
    order.push('before');
    await promise;
    order.push('after');
    expect(order).toEqual(['before', 'after']);
  });
});
