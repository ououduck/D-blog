import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableOfContents } from './TableOfContents';
import type { MarkdownHeading } from '@/utils/headings';

const makeHeadings = (): MarkdownHeading[] => [
  { id: 'intro', level: 1, text: '介绍', rawText: '介绍' },
  { id: 'usage', level: 2, text: '使用方法', rawText: '使用方法' },
  { id: 'faq', level: 2, text: '常见问题', rawText: '常见问题' },
];

describe('TableOfContents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false, // 桌面端视口
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    // 滚动高亮依赖元素几何：统一 mock 为默认矩形。
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  it('无标题时渲染为空', () => {
    const { container } = render(<TableOfContents headings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('有标题时渲染桌面端目录触发按钮', async () => {
    render(<TableOfContents headings={makeHeadings()} />);
    expect(await screen.findByRole('button', { name: /打开目录/ })).toBeInTheDocument();
  });

  it('点击触发按钮打开目录面板', async () => {
    const user = userEvent.setup();
    render(<TableOfContents headings={makeHeadings()} />);
    await user.click(await screen.findByRole('button', { name: /打开目录/ }));
    expect(await screen.findByText('文章目录')).toBeInTheDocument();
  });

  it('目录面板展示标题条目', async () => {
    const user = userEvent.setup();
    render(<TableOfContents headings={makeHeadings()} />);
    await user.click(await screen.findByRole('button', { name: /打开目录/ }));
    expect(await screen.findByText('介绍')).toBeInTheDocument();
    expect(await screen.findByText('使用方法')).toBeInTheDocument();
  });

  it('搜索目录标题过滤条目', async () => {
    const user = userEvent.setup();
    render(<TableOfContents headings={makeHeadings()} />);
    await user.click(await screen.findByRole('button', { name: /打开目录/ }));
    const input = await screen.findByRole('searchbox', { name: '搜索目录标题' });
    await user.type(input, '常见问题');
    expect(await screen.findByText('常见问题')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('使用方法')).not.toBeInTheDocument());
  });
});
