import { describe, it, expect } from 'vitest';
import { canonicalizeHomeQuery, getHomeQueryState, setHomeQueryParam } from './homeQuery';

describe('getHomeQueryState', () => {
  it('无参数时默认 newest / 第 1 页', () => {
    expect(getHomeQueryState(new URLSearchParams(''))).toEqual({ sortOrder: 'newest', page: 1 });
  });

  it('解析 sort=oldest 与 page', () => {
    expect(getHomeQueryState(new URLSearchParams('sort=oldest&page=3'))).toEqual({ sortOrder: 'oldest', page: 3 });
  });

  it('非法 sort 回退为 newest', () => {
    expect(getHomeQueryState(new URLSearchParams('sort=bogus')).sortOrder).toBe('newest');
    expect(getHomeQueryState(new URLSearchParams('sort=OLDEST')).sortOrder).toBe('newest');
  });

  it('非法 page 回退为 1', () => {
    expect(getHomeQueryState(new URLSearchParams('page=0')).page).toBe(1);
    expect(getHomeQueryState(new URLSearchParams('page=-2')).page).toBe(1);
    expect(getHomeQueryState(new URLSearchParams('page=abc')).page).toBe(1);
    expect(getHomeQueryState(new URLSearchParams('page=1.5')).page).toBe(1);
  });

  it('超大 page 回退为 1（非安全整数）', () => {
    expect(getHomeQueryState(new URLSearchParams('page=99999999999999999999')).page).toBe(1);
  });
});

describe('setHomeQueryParam', () => {
  it('sort=oldest 写入参数', () => {
    const next = setHomeQueryParam(new URLSearchParams(''), 'sort', 'oldest');
    expect(next.get('sort')).toBe('oldest');
  });

  it('sort=newest 删除参数（默认值不序列化）', () => {
    const next = setHomeQueryParam(new URLSearchParams('sort=oldest'), 'sort', 'newest');
    expect(next.has('sort')).toBe(false);
  });

  it('page=1 删除参数', () => {
    const next = setHomeQueryParam(new URLSearchParams('page=5'), 'page', 1);
    expect(next.has('page')).toBe(false);
  });

  it('page>1 写入参数', () => {
    const next = setHomeQueryParam(new URLSearchParams(''), 'page', 5);
    expect(next.get('page')).toBe('5');
  });

  it('返回新对象，不修改入参', () => {
    const original = new URLSearchParams('page=5');
    const next = setHomeQueryParam(original, 'page', 1);
    expect(next).not.toBe(original);
    expect(original.get('page')).toBe('5');
  });

  it('保留其他参数', () => {
    const next = setHomeQueryParam(new URLSearchParams('q=abc&sort=oldest'), 'page', 2);
    expect(next.get('q')).toBe('abc');
    expect(next.get('page')).toBe('2');
  });
});

describe('canonicalizeHomeQuery', () => {
  it('合法参数保持原样（往返一致）', () => {
    const params = new URLSearchParams('sort=oldest&page=3');
    const canonical = canonicalizeHomeQuery(params);
    expect(canonical.toString()).toBe('sort=oldest&page=3');
  });

  it('非法参数被规范化', () => {
    const canonical = canonicalizeHomeQuery(new URLSearchParams('sort=bogus&page=0'));
    expect(canonical.toString()).toBe('');
  });

  it('规范化为幂等操作', () => {
    const once = canonicalizeHomeQuery(new URLSearchParams('sort=oldest&page=1&page=2&junk=1'));
    const twice = canonicalizeHomeQuery(once);
    expect(twice.toString()).toBe(once.toString());
  });

  it('page 重复参数取首个合法值', () => {
    // URLSearchParams 保留重复键，get 返回第一个值
    const canonical = canonicalizeHomeQuery(new URLSearchParams('page=7&page=3'));
    expect(canonical.get('page')).toBe('7');
  });
});
