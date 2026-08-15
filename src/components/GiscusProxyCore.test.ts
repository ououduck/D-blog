/**
 * giscus 同源代理核心逻辑测试（functions/giscus-proxy-core.ts）。
 *
 * 覆盖路径白名单映射与父页面 origin 提取：任何对 giscus 代理路径的增改
 * （functions/_middleware.ts 与根目录 middleware.ts 共用）都应在此同步断言。
 */
import { describe, expect, it } from 'vitest';

import { isWidgetPage, parentOriginFromQuery, upstreamPath } from '../../functions/giscus-proxy-core';

describe('upstreamPath — giscus 代理路径白名单', () => {
  it('同源代理前缀 /giscus/* 去掉前缀转发', () => {
    expect(upstreamPath('/giscus/client.js')).toBe('/client.js');
    expect(upstreamPath('/giscus/zh-CN/widget')).toBe('/zh-CN/widget');
    expect(upstreamPath('/giscus/')).toBe('/');
    expect(upstreamPath('/giscus')).toBe('/');
  });

  it('widget 页面（client.js 生成的 iframe 根路径）', () => {
    expect(upstreamPath('/widget')).toBe('/widget');
    expect(upstreamPath('/zh-CN/widget')).toBe('/zh-CN/widget');
    expect(upstreamPath('/en/widget')).toBe('/en/widget');
    expect(upstreamPath('/zh-TW/widget')).toBe('/zh-TW/widget');
  });

  it('widget 自身资源：/_next、/themes、/default.css', () => {
    expect(upstreamPath('/_next/static/chunks/main.js')).toBe('/_next/static/chunks/main.js');
    expect(upstreamPath('/_next/data/buildId/zh-CN/widget.json')).toBe('/_next/data/buildId/zh-CN/widget.json');
    expect(upstreamPath('/themes/dark.css')).toBe('/themes/dark.css');
    expect(upstreamPath('/default.css')).toBe('/default.css');
  });

  it('widget 相对 API 调用（根路径 /api/*）', () => {
    expect(upstreamPath('/api/oauth/token')).toBe('/api/oauth/token');
    expect(upstreamPath('/api/oauth/authorize')).toBe('/api/oauth/authorize');
    expect(upstreamPath('/api/oauth/authorized')).toBe('/api/oauth/authorized');
    expect(upstreamPath('/api/discussions')).toBe('/api/discussions');
    expect(upstreamPath('/api/discussions/categories')).toBe('/api/discussions/categories');
  });

  it('非代理路径一律放行（null）', () => {
    expect(upstreamPath('/')).toBeNull();
    expect(upstreamPath('/posts/hello-world')).toBeNull();
    expect(upstreamPath('/guestbook')).toBeNull();
    expect(upstreamPath('/assets/index.js')).toBeNull();
    expect(upstreamPath('/api/other')).toBeNull();
    expect(upstreamPath('/zh-CN/other')).toBeNull();
  });

  it('入参为 pathname（query 已由调用方剥离）', () => {
    expect(upstreamPath('/giscus/client.js')).toBe('/client.js');
    expect(upstreamPath('/zh-CN/widget')).toBe('/zh-CN/widget');
  });
});

describe('isWidgetPage / parentOriginFromQuery', () => {
  it('识别 widget 页面路径', () => {
    expect(isWidgetPage('/widget')).toBe(true);
    expect(isWidgetPage('/zh-CN/widget')).toBe(true);
    expect(isWidgetPage('/giscus/zh-CN/widget')).toBe(false); // 代理前缀剥离后才是 widget 页
    expect(isWidgetPage('/client.js')).toBe(false);
  });

  it('从 query 提取父页面 origin', () => {
    expect(parentOriginFromQuery('?origin=https%3A%2F%2Fblog.pldduck.com%2Fpost%2Fa')).toBe('https://blog.pldduck.com');
    expect(parentOriginFromQuery('?origin=https%3A%2F%2Fblog.pldduck.com')).toBe('https://blog.pldduck.com');
    expect(parentOriginFromQuery('?origin=not-a-url')).toBeNull();
    expect(parentOriginFromQuery('')).toBeNull();
  });
});
