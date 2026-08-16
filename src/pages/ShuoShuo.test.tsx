import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ShuoShuo } from './ShuoShuo';

vi.mock('@/services/shuoshuo', () => ({
  getInitialShuoShuo: vi.fn(),
}));
vi.mock('@/components/ShuoShuoItem', () => ({
  ShuoShuoItem: ({ item }: { item: { id: string; content: string } }) => (
    <li data-testid={`shuoshuo-${item.id}`}>{item.content}</li>
  ),
}));
vi.mock('@/components/ImageViewer', () => ({
  ImageViewer: () => <div data-testid="mock-viewer" />,
}));
vi.mock('@/components/ShuoShuoShareModal', () => ({
  ShuoShuoShareModal: () => <div data-testid="mock-share" />,
}));

import * as shuoshuoService from '@/services/shuoshuo';

const renderShuoShuo = (initialEntry = '/shuoshuo') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/shuoshuo" element={<ShuoShuo />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ShuoShuo', () => {
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
    vi.mocked(shuoshuoService.getInitialShuoShuo).mockReturnValue([
      { id: 'one', date: '2026-01-01', content: '今天学习了 **React** 的 Hooks', filePath: '/shuoshuo/one.md' },
      { id: 'two', date: '2026-01-02', content: '测试 Vite 构建速度', filePath: '/shuoshuo/two.md' },
    ]);
  });

  it('渲染全部说说', () => {
    renderShuoShuo();
    expect(screen.getByTestId('shuoshuo-one')).toBeInTheDocument();
    expect(screen.getByTestId('shuoshuo-two')).toBeInTheDocument();
  });

  it('搜索按正文内容过滤（markdown 剥离后）', async () => {
    const user = userEvent.setup();
    renderShuoShuo();
    const input = screen.getByLabelText('搜索说说内容');

    await user.type(input, 'React'); // 大小写不敏感匹配 "React"（正文中的粗体标记已被剥离）。
    expect(screen.getByTestId('shuoshuo-one')).toBeInTheDocument();
    expect(screen.queryByTestId('shuoshuo-two')).not.toBeInTheDocument();
  });

  it('清除搜索恢复全部', async () => {
    const user = userEvent.setup();
    renderShuoShuo();
    const input = screen.getByLabelText('搜索说说内容');

    await user.type(input, 'Vite');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('shuoshuo-one')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(screen.getByTestId('shuoshuo-one')).toBeInTheDocument();
    expect(screen.getByTestId('shuoshuo-two')).toBeInTheDocument();
  });
});
