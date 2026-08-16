import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pingBusuanzi, fillBusuanziSpans } from './busuanzi';

const makeSpan = (id: string) => {
  const span = document.createElement('span');
  span.id = id;
  document.body.appendChild(span);
  return span;
};

describe('busuanzi 统计', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('上报当前页并回填页面级计数', async () => {
    const siteSpan = makeSpan('busuanzi_value_site_pv');
    const pageSpan = makeSpan('busuanzi_value_page_pv');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ busuanzi_value_site_pv: '1234', busuanzi_value_page_pv: '56' }),
      }),
    );

    pingBusuanzi();
    // rAF 回填需要等待
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));

    expect(siteSpan.textContent).toBe('1234');
    expect(pageSpan.textContent).toBe('56');
  });

  it('fetch 失败时静默（不抛错）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(() => pingBusuanzi()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('fetch 失败时把「加载中」占位替换为「—」，已填充的不覆盖', async () => {
    const pendingSpan = makeSpan('busuanzi_page_pv');
    pendingSpan.textContent = '加载中';
    const filledSpan = makeSpan('busuanzi_site_pv');
    filledSpan.textContent = '1234';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    pingBusuanzi();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pendingSpan.textContent).toBe('—');
    expect(filledSpan.textContent).toBe('1234');
  });

  it('fillBusuanziSpans 无缓存时为空操作', () => {
    expect(() => fillBusuanziSpans()).not.toThrow();
  });
});
