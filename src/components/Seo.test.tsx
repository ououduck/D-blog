import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { Seo } from './Seo';

const renderSeo = (props: React.ComponentProps<typeof Seo>, route = '/') =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        <Seo {...props} />
      </MemoryRouter>
    </HelmetProvider>,
  );

const headTag = (selector: string): HTMLElement | null => document.head.querySelector(selector);
const headAttr = (selector: string, attr: string): string | null => headTag(selector)?.getAttribute(attr) ?? null;

describe('Seo', () => {
  afterEach(() => {
    // 清空 Helmet 写入的 head 标签，避免跨用例污染。
    document.head.querySelectorAll('[data-rh="true"]').forEach((element) => element.remove());
  });

  it('渲染 title 与 description', () => {
    renderSeo({ title: '测试页' });
    expect(document.title).toContain('测试页');
    expect(headAttr('meta[name="description"]', 'content')).toBeTruthy();
  });

  it('canonical 保留内容型参数（category/tag/q）', () => {
    renderSeo({ title: '分类', url: '/?category=前端' }, '/?category=前端');
    const canonical = headAttr('link[rel="canonical"]', 'href') ?? '';
    expect(canonical).toContain('category=');
    expect(canonical.endsWith('/?category=%E5%89%8D%E7%AB%AF')).toBe(true);
  });

  it('canonical 丢弃纯 UI 参数（sort）', () => {
    renderSeo({ title: '首页', url: '/?sort=oldest&category=技术' }, '/?sort=oldest&category=技术');
    const canonical = headAttr('link[rel="canonical"]', 'href') ?? '';
    expect(canonical).not.toContain('sort');
    expect(canonical).toContain('category=');
  });

  it('canonical 页码大于 1 时保留', () => {
    renderSeo({ title: '归档', url: '/archive?page=3' }, '/archive?page=3');
    expect(headAttr('link[rel="canonical"]', 'href')).toContain('page=3');
  });

  it('canonical 第 1 页删除 page 参数', () => {
    renderSeo({ title: '归档', url: '/archive?page=1' }, '/archive?page=1');
    expect(headAttr('link[rel="canonical"]', 'href')).not.toContain('page=');
  });

  it('canonical 参数按固定顺序归一化（category→page）', () => {
    renderSeo({ title: '分类', url: '/?page=2&q=react&category=技术' }, '/?page=2&q=react&category=技术');
    const canonical = headAttr('link[rel="canonical"]', 'href') ?? '';
    const query = canonical.split('?')[1] ?? '';
    expect(query).toBe('category=%E6%8A%80%E6%9C%AF&q=react&page=2');
  });

  it('带 q 参数时输出 noindex', () => {
    renderSeo({ title: '搜索', url: '/search?q=react' }, '/search?q=react');
    expect(headAttr('meta[name="robots"]', 'content')).toContain('noindex');
  });

  it('noindex 显式开启时输出 noindex', () => {
    renderSeo({ title: '收藏', noindex: true });
    expect(headAttr('meta[name="robots"]', 'content')).toContain('noindex');
  });

  it('输出 JSON-LD 结构化数据（React 19 不提升内联 script，保留在 body 渲染位，规范合法）', () => {
    renderSeo({ title: '测试页' });
    const scripts = Array.from(document.querySelectorAll('script'));
    const script = scripts.find((element) => (element.textContent || '').includes('"@type"'));
    expect(script).toBeTruthy();
    const json = JSON.parse(script?.textContent ?? '{}');
    // 默认输出为数组（WebSite + Organization 两条站点级 schema）。
    const schemas = Array.isArray(json) ? json : [json];
    expect(schemas.some((schema) => schema['@type'] === 'WebSite')).toBe(true);
    expect(schemas.some((schema) => schema['@type'] === 'Organization')).toBe(true);
  });

  it('文章页输出 article 类型的 OG 标签', () => {
    renderSeo({
      title: '文章',
      type: 'article',
      publishedTime: '2026-03-14',
      modifiedTime: '2026-03-20',
      section: '技术',
      tags: ['React'],
      authors: ['跑路的duck'],
    });
    expect(headAttr('meta[property="og:type"]', 'content')).toBe('article');
    expect(headAttr('meta[property="article:published_time"]', 'content')).toBe('2026-03-14');
    expect(headAttr('meta[property="article:section"]', 'content')).toBe('技术');
    expect(headAttr('meta[property="article:tag"]', 'content')).toBe('React');
  });
});
