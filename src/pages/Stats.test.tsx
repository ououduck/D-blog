import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Stats } from './Stats';

const renderStats = () =>
  render(
    <MemoryRouter initialEntries={['/stats']}>
      <Stats />
    </MemoryRouter>,
  );

describe('Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    }
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

  it('渲染统计页标题与 D-Umami 访问分析卡片', () => {
    renderStats();
    expect(screen.getByRole('heading', { name: '站点统计' })).toBeInTheDocument();
    expect(screen.getByText('D-Umami 访问分析')).toBeInTheDocument();
  });

  it('渲染跳转 D-Umami 查看按钮并指向共享看板', () => {
    renderStats();
    const link = screen.getByRole('link', { name: '跳转D-Umami查看' });
    expect(link).toHaveAttribute('href', 'https://umami.pldduck.com/share/zWEt3cddtxLtAA0r');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: '查看网站运行状态' })).toBeInTheDocument();
  });
});
