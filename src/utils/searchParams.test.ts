import { describe, it, expect } from 'vitest';
import { clearSearchQueryParams, setSearchQueryParams } from './searchParams';

describe('setSearchQueryParams', () => {
  it('空查询删除 q 参数', () => {
    const params = new URLSearchParams('?q=hello&page=2');
    const next = setSearchQueryParams(params, '');
    expect(next.toString()).toBe('page=2');
  });

  it('非空查询设置 q 参数', () => {
    const params = new URLSearchParams('?page=2');
    const next = setSearchQueryParams(params, 'react');
    expect(next.get('q')).toBe('react');
    expect(next.get('page')).toBe('2');
  });

  it('同时删除传入的衍生参数（page/year 等）', () => {
    const params = new URLSearchParams('?q=old&page=3&year=2026');
    const next = setSearchQueryParams(params, 'new', ['page', 'year']);
    expect(next.get('q')).toBe('new');
    expect(next.has('page')).toBe(false);
    expect(next.has('year')).toBe(false);
  });

  it('保留其他无关参数', () => {
    const params = new URLSearchParams('?tag=react&q=a');
    const next = setSearchQueryParams(params, 'b');
    expect(next.get('tag')).toBe('react');
  });
});

describe('clearSearchQueryParams', () => {
  it('删除 q 与传入的衍生参数', () => {
    const params = new URLSearchParams('?q=x&page=2&year=2026&tag=react');
    const next = clearSearchQueryParams(params, ['page', 'year']);
    expect(next.has('q')).toBe(false);
    expect(next.has('page')).toBe(false);
    expect(next.has('year')).toBe(false);
    expect(next.get('tag')).toBe('react');
  });

  it('无衍生参数时仅删除 q', () => {
    const params = new URLSearchParams('?q=x&tag=react');
    const next = clearSearchQueryParams(params);
    expect(next.has('q')).toBe(false);
    expect(next.get('tag')).toBe('react');
  });
});
