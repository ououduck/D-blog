import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PostCard } from './PostCard';
import type { PostMetadata } from '@/types';

// future 标志与 App.tsx 的 Router 保持一致，消除 React Router v7 迁移警告。
const renderWithRouter = (ui: React.ReactNode) =>
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>);

const makePost = (overrides: Partial<PostMetadata> = {}): PostMetadata => ({
  id: 'test-post',
  title: '测试文章标题',
  excerpt: '这是一段测试摘要',
  date: '2026-01-15',
  category: '技术',
  filePath: '/posts/test-post.md',
  readTime: '5分钟阅读',
  tags: ['React', 'TypeScript', '测试'],
  ...overrides,
});

const baseProps = {
  index: 0,
  onShare: vi.fn(),
  isSaved: false,
  isSaving: false,
  onToggleSave: vi.fn(),
};

describe('PostCard', () => {
  it('普通卡片渲染标题、分类、摘要与元信息', () => {
    renderWithRouter(<PostCard post={makePost()} {...baseProps} />);
    expect(screen.getByRole('heading', { name: '测试文章标题' })).toBeInTheDocument();
    expect(screen.getByText('技术')).toBeInTheDocument();
    expect(screen.getByText('这是一段测试摘要')).toBeInTheDocument();
    expect(screen.getByText('2026-01-15')).toBeInTheDocument();
    expect(screen.getByText('5分钟阅读')).toBeInTheDocument();
  });

  it('文章标题链接指向文章详情页', () => {
    renderWithRouter(<PostCard post={makePost()} {...baseProps} />);
    // 封面图与标题各有一个同 aria-label 的链接，取其一断言 href
    const link = screen.getAllByRole('link', { name: '阅读文章：测试文章标题' })[0];
    expect(link).toHaveAttribute('href', '/post/test-post');
  });

  it('标签最多展示 3 个，点击标签链接到筛选页', () => {
    const post = makePost({ tags: ['React', 'TypeScript', '测试', '多余标签'] });
    renderWithRouter(<PostCard post={post} {...baseProps} />);
    expect(screen.getByRole('link', { name: 'React' })).toHaveAttribute('href', '/tags?tag=React');
    expect(screen.getByRole('link', { name: 'TypeScript' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '测试' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '多余标签' })).not.toBeInTheDocument();
  });

  it('无标签时不渲染标签行', () => {
    renderWithRouter(<PostCard post={makePost({ tags: [] })} {...baseProps} />);
    expect(screen.queryByRole('link', { name: 'React' })).not.toBeInTheDocument();
  });

  it('收藏按钮按 isSaved 切换 aria-pressed 并回调', async () => {
    const user = userEvent.setup();
    const onToggleSave = vi.fn();
    renderWithRouter(<PostCard post={makePost()} {...baseProps} isSaved={true} onToggleSave={onToggleSave} />);
    const button = screen.getByRole('button', { name: '取消收藏：测试文章标题' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.click(button);
    expect(onToggleSave).toHaveBeenCalledTimes(1);
  });

  it('分享按钮触发 onShare 回调', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    renderWithRouter(<PostCard post={makePost()} {...baseProps} onShare={onShare} />);
    await user.click(screen.getByRole('button', { name: '分享文章：测试文章标题' }));
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-post' }));
  });

  it('评论数存在时展示评论计数', () => {
    renderWithRouter(<PostCard post={makePost({ commentCount: 12 })} {...baseProps} />);
    expect(screen.getByText('12 条评论')).toBeInTheDocument();
  });

  it('精选卡片渲染精选标记', () => {
    renderWithRouter(<PostCard post={makePost({ featured: true })} {...baseProps} featured />);
    expect(screen.getByText('精选')).toBeInTheDocument();
  });

  it('置顶精选卡片渲染置顶标记', () => {
    renderWithRouter(<PostCard post={makePost({ featured: true, 'featured-top': 1 })} {...baseProps} featured />);
    expect(screen.getByText('置顶')).toBeInTheDocument();
  });

  it('无封面图时渲染占位而非图片', () => {
    renderWithRouter(<PostCard post={makePost({ coverImage: undefined })} {...baseProps} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('有封面图时渲染带 alt 的图片', () => {
    renderWithRouter(<PostCard post={makePost({ coverImage: '/covers/test.png' })} {...baseProps} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt', '测试文章标题');
  });
});
