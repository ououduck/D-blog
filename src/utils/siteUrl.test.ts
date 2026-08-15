import { describe, it, expect } from 'vitest';
import { absoluteSiteUrl, assetUrl, getRouterBasename, getSiteBasePath, routeUrl } from './siteUrl';

const SITE_URL = 'https://blog.pldduck.com';

describe('getSiteBasePath / getRouterBasename', () => {
  it('默认 base path 为根路径', () => {
    expect(getSiteBasePath()).toBe('/');
  });

  it('根路径下 router basename 为 /', () => {
    expect(getRouterBasename()).toBe('/');
  });
});

describe('routeUrl', () => {
  it('根路径下原样返回绝对路径', () => {
    expect(routeUrl('/about', '/')).toBe('/about');
    expect(routeUrl('/post/hello', '/')).toBe('/post/hello');
  });

  it('子路径 base 下拼接前缀', () => {
    expect(routeUrl('/about', '/blog/')).toBe('/blog/about');
  });

  it('相对路径补全为绝对路径', () => {
    expect(routeUrl('about', '/blog/')).toBe('/blog/about');
  });

  it('已带 base 前缀的路径不重复拼接', () => {
    expect(routeUrl('/blog/about', '/blog/')).toBe('/blog/about');
    expect(routeUrl('/blog', '/blog/')).toBe('/blog');
  });

  it('保留查询参数与 hash', () => {
    expect(routeUrl('/post/a?x=1#section', '/blog/')).toBe('/blog/post/a?x=1#section');
  });

  it('外部 URL 与锚点原样返回', () => {
    expect(routeUrl('https://example.com/x', '/blog/')).toBe('https://example.com/x');
    expect(routeUrl('//cdn.example.com/x', '/blog/')).toBe('//cdn.example.com/x');
    expect(routeUrl('#anchor', '/blog/')).toBe('#anchor');
  });
});

describe('assetUrl', () => {
  it('根路径下返回站内绝对路径', () => {
    expect(assetUrl('logo.png', '/')).toBe('/logo.png');
  });

  it('子路径 base 下拼接前缀', () => {
    expect(assetUrl('/logo.png', '/blog/')).toBe('/blog/logo.png');
  });

  it('外部资源与 data URI 原样返回', () => {
    expect(assetUrl('https://img.pldduck.com/x.png', '/blog/')).toBe('https://img.pldduck.com/x.png');
    expect(assetUrl('data:image/png;base64,AAAA', '/blog/')).toBe('data:image/png;base64,AAAA');
    expect(assetUrl('//cdn.example.com/x.png', '/blog/')).toBe('//cdn.example.com/x.png');
  });
});

describe('absoluteSiteUrl', () => {
  it('空值返回站点根地址', () => {
    expect(absoluteSiteUrl(undefined, SITE_URL, '/')).toBe('https://blog.pldduck.com/');
  });

  it('子路径 base 下根地址带前缀', () => {
    expect(absoluteSiteUrl(undefined, SITE_URL, '/blog/')).toBe('https://blog.pldduck.com/blog/');
  });

  it('站内路径拼成完整 URL', () => {
    expect(absoluteSiteUrl('/about', SITE_URL, '/')).toBe('https://blog.pldduck.com/about');
    expect(absoluteSiteUrl('/about', SITE_URL, '/blog/')).toBe('https://blog.pldduck.com/blog/about');
  });

  it('相对路径补全为绝对路径', () => {
    expect(absoluteSiteUrl('about', SITE_URL, '/')).toBe('https://blog.pldduck.com/about');
  });

  it('同源外部 URL 被重新挂到 base path 下', () => {
    expect(absoluteSiteUrl('https://blog.pldduck.com/post/x', SITE_URL, '/blog/')).toBe(
      'https://blog.pldduck.com/blog/post/x',
    );
  });

  it('异源 URL 原样返回', () => {
    expect(absoluteSiteUrl('https://other.example.com/x', SITE_URL, '/blog/')).toBe('https://other.example.com/x');
  });

  it('保留查询参数与 hash', () => {
    expect(absoluteSiteUrl('/post/x?page=2#top', SITE_URL, '/')).toBe('https://blog.pldduck.com/post/x?page=2#top');
  });
});
