import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Stats } from './Stats';

vi.mock('@/services/busuanzi', () => ({
  pingBusuanzi: vi.fn(),
  fillBusuanziSpans: vi.fn(),
}));

const renderStats = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/stats']}>
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

  it('渲染统计页标题与访问统计卡片', () => {
    renderStats();
    expect(screen.getByRole('heading', { name: '站点统计' })).toBeInTheDocument();
    expect(screen.getByText('访问统计')).toBeInTheDocument();
  });

  it('渲染统计指标（今日访问量等）', () => {
    renderStats();
    expect(screen.getByText('今日总访问量')).toBeInTheDocument();
    expect(screen.getByText('站点总访问量')).toBeInTheDocument();
  });
});
