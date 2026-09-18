import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { NotFound } from './NotFound';

// 搜索页探针：MemoryRouter 下断言 window.location 是恒真（testing.md 规则），
// 改用 useSearchParams 渲染真实路由查询参数。
const SearchProbe: React.FC = () => {
  const [params] = useSearchParams();
  return <div data-testid="search-probe">q={params.get('q') ?? ''}</div>;
};

const renderAtPath = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/search" element={<SearchProbe />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  );

describe('NotFound — 调试路径水合一致性', () => {
  it('SSR 首帧输出占位符，不渲染真实路径（与 SSG 预渲染输出一致）', () => {
    // SSG 用占位路由 /__missing__ 预渲染 404 页；若首帧直接输出
    // location.pathname，客户端在真实未知路径水合时会与 SSR 文本不一致。
    const html = renderToString(
      <MemoryRouter initialEntries={['/__missing__']}>
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(html).toContain('Path: —');
    expect(html).not.toContain('Path: /__missing__');
  });

  it('挂载后展示真实路径调试信息', async () => {
    renderAtPath('/some/unknown/path');
    await waitFor(() => {
      expect(screen.getByText('Path: /some/unknown/path')).toBeInTheDocument();
    });
  });
});

describe('NotFound — 404 页功能模块', () => {
  it('渲染搜索输入框、快速入口与跑路文案', () => {
    renderAtPath('/missing');
    expect(screen.getByRole('heading', { name: '这篇文章跑路了 🏃' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索本站内容' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /归档/ })).toHaveAttribute('href', '/archive');
    expect(screen.getByRole('link', { name: /标签/ })).toHaveAttribute('href', '/tags');
    expect(screen.getByRole('link', { name: /进入搜索页/ })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: /返回首页/ })).toHaveAttribute('href', '/');
  });

  it('搜索框输入关键词回车跳转 /search?q=', async () => {
    const user = userEvent.setup();
    renderAtPath('/missing');
    await user.type(screen.getByRole('searchbox', { name: '搜索本站内容' }), '静态博客{Enter}');
    const probe = await screen.findByTestId('search-probe');
    expect(probe).toHaveTextContent('q=静态博客');
  });

  it('空关键词回车进入 /search（不带 q）', async () => {
    const user = userEvent.setup();
    renderAtPath('/missing');
    await user.type(screen.getByRole('searchbox', { name: '搜索本站内容' }), '{Enter}');
    const probe = await screen.findByTestId('search-probe');
    expect(probe).toHaveTextContent('q=');
  });
});
