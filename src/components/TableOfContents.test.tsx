import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableOfContents, SHOW_TOC_SEARCH_THRESHOLD } from './TableOfContents';
import type { MarkdownHeading } from '@/utils/headings';

const makeHeadings = (): MarkdownHeading[] => [
  { id: 'intro', level: 1, text: '介绍', rawText: '介绍' },
  { id: 'usage', level: 2, text: '使用方法', rawText: '使用方法' },
  { id: 'faq', level: 2, text: '常见问题', rawText: '常见问题' },
];

/** 超过搜索阈值的长目录（触发按需搜索入口）。 */
const makeLongHeadings = (): MarkdownHeading[] =>
  Array.from({ length: SHOW_TOC_SEARCH_THRESHOLD + 2 }, (_, index) => ({
    id: `h-${index}`,
    level: 1,
    text: `章节 ${index}`,
    rawText: `章节 ${index}`,
  }));

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

  it('目录项不含数字 badge（大纲式视觉减法）', async () => {
    const user = userEvent.setup();
    render(<TableOfContents headings={makeHeadings()} />);
    await user.click(await screen.findByRole('button', { name: /打开目录/ }));
    await screen.findByText('介绍');
    // 旧版 flat-index 数字 badge（01/02…）已删除
    expect(screen.queryByText('01')).not.toBeInTheDocument();
  });

  it('短目录不渲染搜索入口（按需显示）', async () => {
    const user = userEvent.setup();
    render(<TableOfContents headings={makeHeadings()} />);
    await user.click(await screen.findByRole('button', { name: /打开目录/ }));
    await screen.findByText('介绍');
    expect(screen.queryByRole('button', { name: '搜索目录标题' })).not.toBeInTheDocument();
  });

  it('长目录提供搜索入口：点击后出现输入框并聚焦（键盘按需弹出）', async () => {
    const user = userEvent.setup();
    render(<TableOfContents headings={makeLongHeadings()} />);
    await user.click(await screen.findByRole('button', { name: /打开目录/ }));
    // 打开面板时：无搜索框（不自动弹键盘）
    expect(screen.queryByRole('searchbox', { name: '搜索目录标题' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '搜索目录标题' }));
    const input = await screen.findByRole('searchbox', { name: '搜索目录标题' });
    expect(input).toHaveFocus();

    await user.type(input, '章节 3');
    expect(await screen.findByText('章节 3')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('章节 4')).not.toBeInTheDocument());
  });

  it('Escape 关闭目录并归还焦点到触发按钮（键盘可达性回归）', async () => {
    const user = userEvent.setup();
    render(<TableOfContents headings={makeHeadings()} />);
    const trigger = await screen.findByRole('button', { name: /打开目录/ });
    await user.click(trigger);
    await screen.findByText('文章目录');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('文章目录')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('点击目录条目滚动到对应标题并更新 hash（跳转回归）', async () => {
    const user = userEvent.setup();
    // 在文档中放置与目录 id 对应的标题锚点：id 不匹配时 getElementById 落空，
    // 点击将静默失效（目录无法跳转的根因）。
    const headingElement = document.createElement('h2');
    headingElement.id = 'usage';
    document.body.appendChild(headingElement);

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<TableOfContents headings={makeHeadings()} />);
    await user.click(await screen.findByRole('button', { name: /打开目录/ }));
    await screen.findByText('文章目录');

    await user.click(screen.getByText('使用方法'));
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ top: expect.any(Number), behavior: expect.any(String) }),
    );
    expect(window.location.hash).toContain('usage');

    scrollToSpy.mockRestore();
    headingElement.remove();
  });

  it('受控模式（移动 Sheet）：点击条目后关闭并更新 hash', async () => {
    const user = userEvent.setup();
    // 移动端视口
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: query.includes('max-width: 1023px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onOpenChange = vi.fn();
    const headingElement = document.createElement('h2');
    headingElement.id = 'intro';
    document.body.appendChild(headingElement);

    render(
      <TableOfContents
        headings={makeHeadings()}
        isOpen
        onOpenChange={onOpenChange}
        mobileShowTrigger={false}
        desktopShowTrigger={false}
      />,
    );
    await screen.findByText('文章目录');

    await user.click(screen.getByText('介绍'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(window.location.hash).toContain('intro');
    headingElement.remove();
  });

  it('打开移动 Sheet：默认聚焦容器、搜索框不渲染（键盘不自动弹出）', async () => {
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: query.includes('max-width: 1023px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<TableOfContents headings={makeHeadings()} isOpen mobileShowTrigger={false} desktopShowTrigger={false} />);
    await screen.findByText('文章目录');

    expect(screen.queryByRole('searchbox', { name: '搜索目录标题' })).not.toBeInTheDocument();
    // useModalOverlay 初始聚焦 Sheet 容器（tabIndex=-1）而非输入框
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });
});
