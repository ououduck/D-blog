import { describe, it, expect } from 'vitest';
import { mergeClassName } from './classNames';

describe('mergeClassName', () => {
  it('拼接非空类名', () => {
    expect(mergeClassName('a', 'b', 'c')).toBe('a b c');
  });

  it('过滤空值/undefined/false/null', () => {
    expect(mergeClassName('a', undefined, '', false, null, 'b')).toBe('a b');
  });

  it('全空时返回空字符串', () => {
    expect(mergeClassName()).toBe('');
    expect(mergeClassName(undefined, false, '')).toBe('');
  });

  it('保留前导/尾随空格的原样值（不 trim）', () => {
    expect(mergeClassName(' a ', 'b')).toBe(' a  b');
  });
});
