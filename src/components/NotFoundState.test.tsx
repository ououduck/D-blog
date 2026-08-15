import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundState } from './NotFoundState';

const renderWithRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('NotFoundState', () => {
  it('渲染标题与描述', () => {
    renderWithRouter(<NotFoundState title="页面不存在" description="你访问的页面走丢了" />);
    expect(screen.getByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
    expect(screen.getByText('你访问的页面走丢了')).toBeInTheDocument();
  });

  it('渲染 404 标识', () => {
    renderWithRouter(<NotFoundState title="页面不存在" description="你访问的页面走丢了" />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('返回链接使用 backTo 与 backLabel', () => {
    renderWithRouter(
      <NotFoundState title="页面不存在" description="你访问的页面走丢了" backTo="/about" backLabel="去关于页" />,
    );
    const link = screen.getByRole('link', { name: '去关于页' });
    expect(link).toHaveAttribute('href', '/about');
  });

  it('默认返回首页', () => {
    renderWithRouter(<NotFoundState title="页面不存在" description="你访问的页面走丢了" />);
    const link = screen.getByRole('link', { name: '返回首页' });
    expect(link).toHaveAttribute('href', '/');
  });

  it('提供 debugLabel 时展示调试信息', () => {
    renderWithRouter(<NotFoundState title="页面不存在" description="你访问的页面走丢了" debugLabel="/post/unknown" />);
    expect(screen.getByText('/post/unknown')).toBeInTheDocument();
  });

  it('未提供 debugLabel 时不渲染调试块', () => {
    renderWithRouter(<NotFoundState title="页面不存在" description="你访问的页面走丢了" />);
    expect(screen.queryByText('/post/unknown')).not.toBeInTheDocument();
  });
});
