import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { GiscusComments } from './GiscusComments';

// 站点配置打桩：默认启用 giscus 并直连官方源（与 config/site.config.json 一致）。
vi.mock('@config/site.config', () => ({
  siteConfig: {
    giscusEnabled: true,
    comments: {
      repo: 'owner/repo',
      repoId: 'R_123',
      category: 'Comments',
      categoryId: 'D_456',
      origin: 'https://giscus.app',
      strict: false,
    },
  },
}));

// jsdom 未实现 IntersectionObserver：手动模拟，让测试可控地触发懒加载。
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  targets: Element[] = [];

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    this.targets.push(target);
  }

  unobserve() {}
  disconnect() {}

  // 测试辅助：模拟进入视口
  triggerIntersect() {
    this.callback(
      this.targets.map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
}

describe('GiscusComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // 恢复离线测试对 navigator.onLine 的篡改，避免污染后续用例。
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  // 触发懒加载：进入视口 → state 更新 → 注入脚本的 effect 重跑。
  const triggerNearViewport = () => {
    act(() => {
      MockIntersectionObserver.instances[0]?.triggerIntersect();
    });
  };

  it('渲染评论区块标题', () => {
    render(<GiscusComments postId="test-post" />);
    expect(screen.getByRole('heading', { name: '评论' })).toBeInTheDocument();
  });

  it('未进入视口前不加载评论脚本，显示懒加载提示', () => {
    render(<GiscusComments postId="test-post" />);
    expect(screen.getByText('评论将在滚动到此处时自动加载。')).toBeInTheDocument();
    // 未触发 IntersectionObserver 时不注入 giscus 脚本
    expect(document.querySelector('script[data-repo]')).not.toBeInTheDocument();
  });

  it('进入视口后注入 giscus 脚本（直连官方来源）', () => {
    render(<GiscusComments postId="test-post" />);
    triggerNearViewport();

    const script = document.querySelector<HTMLScriptElement>('script[data-repo]');
    expect(script).not.toBeNull();
    expect(script?.src).toContain('https://giscus.app/client.js');
    expect(script?.dataset.repo).toBe('owner/repo');
    expect(script?.dataset.mapping).toBe('pathname');
    expect(script?.dataset.lang).toBe('zh-CN');
    expect(script?.dataset.loading).toBe('lazy');
  });

  it('离线时显示离线提示且不注入脚本', () => {
    // 模拟 navigator.onLine = false
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<GiscusComments postId="test-post" />);
    expect(screen.getByText('当前处于离线状态，恢复网络后评论区会自动加载。')).toBeInTheDocument();
    triggerNearViewport();
    expect(document.querySelector('script[data-repo]')).not.toBeInTheDocument();
  });

  it('mapping=number 时透传 term', () => {
    render(<GiscusComments postId="test-post" mapping="number" term={42} />);
    triggerNearViewport();
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-repo]');
    // 注入的脚本可能存在多个（effect 重跑会先清空再注入），取最后一个
    const script = scripts[scripts.length - 1];
    expect(script).toBeDefined();
    expect(script?.getAttribute('data-term')).toBe('42');
  });

  it('mapping=specific 时透传字符串 term', () => {
    render(<GiscusComments postId="test-post" mapping="specific" term="discussion-title" />);
    triggerNearViewport();
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-repo]');
    const script = scripts[scripts.length - 1];
    expect(script).toBeDefined();
    expect(script?.getAttribute('data-term')).toBe('discussion-title');
  });

  it('脚本加载失败后显示失败状态（自动重试耗尽）', () => {
    vi.useFakeTimers();
    try {
      render(<GiscusComments postId="test-post" />);
      triggerNearViewport();
      const script = document.querySelector<HTMLScriptElement>('script[data-repo]');
      expect(script).not.toBeNull();

      // 首次失败（error 事件）→ 进入自动重试调度。
      act(() => {
        script?.dispatchEvent(new Event('error'));
      });
      // 推进重试延迟（RETRY_DELAY_MS=2500），触发 autoRetryCount 递增 → effect 重跑注入新脚本。
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      const retriedScript = document.querySelector<HTMLScriptElement>('script[data-repo]');
      expect(retriedScript).not.toBeNull();

      // 第二次尝试也失败 → 重试耗尽 → 失败状态。
      act(() => {
        retriedScript?.dispatchEvent(new Event('error'));
      });
      expect(screen.getByText(/评论区加载失败/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '重新加载评论' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
