import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NotFound } from './NotFound';

// future 标志与 App.tsx 的 Router 保持一致，消除 React Router v7 迁移警告。
const renderAtPath = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
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
