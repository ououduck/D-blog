import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProgressiveImage } from './ProgressiveImage';

describe('ProgressiveImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('渲染 img 并透传 src/alt/width/height', () => {
    render(<ProgressiveImage src="/img/cover.png" alt="封面" width={800} height={450} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/img/cover.png');
    expect(img).toHaveAttribute('alt', '封面');
    expect(img).toHaveAttribute('width', '800');
    expect(img).toHaveAttribute('height', '450');
  });

  it('默认懒加载与异步解码', () => {
    render(<ProgressiveImage src="/img/a.png" alt="a" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('fetchPriority=high 时 eager 加载', () => {
    render(<ProgressiveImage src="/img/lcp.png" alt="lcp" fetchPriority="high" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'eager');
  });

  it('无 src 时渲染加载失败提示而非 img', () => {
    render(<ProgressiveImage src="" alt="缺失" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/图片暂时无法加载/)).toBeInTheDocument();
  });

  it('图片加载完成后触发 onLoad 回调', () => {
    const onLoad = vi.fn();
    render(<ProgressiveImage src="/img/b.png" alt="b" onLoad={onLoad} />);
    const img = screen.getByRole('img');
    fireEvent.load(img);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('加载失败时触发 onError 回调并显示失败提示', () => {
    const onError = vi.fn();
    render(<ProgressiveImage src="/img/broken.png" alt="坏图" onError={onError} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/图片暂时无法加载/)).toBeInTheDocument();
  });
});
