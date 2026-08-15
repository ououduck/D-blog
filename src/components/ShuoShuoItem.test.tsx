import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ShuoShuoItem } from './ShuoShuoItem';
import type { ShuoShuo } from '@/types';

const makeItem = (overrides: Partial<ShuoShuo> = {}): ShuoShuo => ({
  id: 'shuo-1',
  date: '2026-01-15',
  content: '今天天气不错，分享一个开源项目。',
  filePath: '/shuoshuo/shuo-1.md',
  ...overrides,
});

const renderItem = (props: {
  item: ShuoShuo;
  onPreview?: (src: string, alt?: string) => void;
  onShare?: (item: ShuoShuo) => void;
  showDetailLink?: boolean;
}) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ShuoShuoItem
        item={props.item}
        onPreview={props.onPreview ?? vi.fn()}
        onShare={props.onShare ?? vi.fn()}
        showDetailLink={props.showDetailLink}
      />
    </MemoryRouter>,
  );

describe('ShuoShuoItem', () => {
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

  it('渲染正文内容与作者', () => {
    renderItem({ item: makeItem() });
    expect(screen.getByText('今天天气不错，分享一个开源项目。')).toBeInTheDocument();
  });

  it('渲染永久链接指向详情页', () => {
    renderItem({ item: makeItem() });
    const link = screen.getByRole('link', { name: /查看这条说说/ });
    expect(link).toHaveAttribute('href', '/shuoshuo/shuo-1');
  });

  it('showDetailLink=false 时不渲染永久链接', () => {
    renderItem({ item: makeItem(), showDetailLink: false });
    expect(screen.queryByRole('link', { name: /查看这条说说/ })).not.toBeInTheDocument();
  });

  it('分享按钮触发 onShare 回调', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    renderItem({ item: makeItem(), onShare });
    await user.click(screen.getByRole('button', { name: /分享这条说说/ }));
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 'shuo-1' }));
  });

  it('有图片时渲染图片网格并可预览', async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    renderItem({ item: makeItem({ images: ['/img/a.png', '/img/b.png'] }), onPreview });
    const buttons = screen.getAllByRole('button', { name: /查看图片/ });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]);
    expect(onPreview).toHaveBeenCalledWith(expect.stringContaining('/img/a.png'), '说说图片 1');
  });

  it('无图片时不渲染图片网格', () => {
    renderItem({ item: makeItem() });
    expect(screen.queryByRole('button', { name: /查看图片/ })).not.toBeInTheDocument();
  });
});
