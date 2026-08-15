import { describe, it, expect } from 'vitest';
import { createFriendLinkApplication, validateFriendLinkApplication } from './friendLinkApplication';
import type { FriendLinkApplicationValues } from './friendLinkApplication';

const validValues: FriendLinkApplicationValues = {
  name: '示例博客',
  description: '一个技术分享博客',
  avatar: 'https://example.com/avatar.png',
  url: 'https://example.com',
  friendPageUrl: 'https://example.com/friends',
  contact: 'user@example.com',
  reciprocalLinkConfirmed: true,
};

describe('validateFriendLinkApplication', () => {
  it('合法输入不产生错误', () => {
    expect(validateFriendLinkApplication(validValues, 'example-blog')).toEqual({});
  });

  it('空字段逐项报错', () => {
    const errors = validateFriendLinkApplication(
      { ...validValues, name: '  ', url: '', contact: '' },
      'example-blog',
    );
    expect(errors.name).toBe('此项不能为空。');
    expect(errors.url).toBe('此项不能为空。');
    expect(errors.contact).toBe('此项不能为空。');
  });

  it('非法 URL 报错（非 http(s) 协议与畸形地址）', () => {
    const errors = validateFriendLinkApplication(
      { ...validValues, avatar: 'ftp://example.com/a.png', url: 'javascript:alert(1)', friendPageUrl: 'not-a-url' },
      'example-blog',
    );
    expect(errors.avatar).toBe('请输入有效的 HTTP(S) 地址。');
    expect(errors.url).toBe('请输入有效的 HTTP(S) 地址。');
    expect(errors.friendPageUrl).toBe('请输入有效的 HTTP(S) 地址。');
  });

  it('未确认互链时报错', () => {
    const errors = validateFriendLinkApplication({ ...validValues, reciprocalLinkConfirmed: false }, 'example-blog');
    expect(errors.reciprocalLinkConfirmed).toBe('请先添加本站友链并确认。');
  });

  it('文件名校验：空、非法字符', () => {
    expect(validateFriendLinkApplication(validValues, '').filename).toBe('请输入文件名。');
    expect(validateFriendLinkApplication(validValues, '带中文.json').filename).toContain('只能包含');
    expect(validateFriendLinkApplication(validValues, 'a/b.json').filename).toContain('只能包含');
  });

  it('输入值先 trim 再校验（前后空白不误判）', () => {
    const errors = validateFriendLinkApplication(
      { ...validValues, name: '  示例博客  ', url: '  https://example.com  ' },
      'example-blog',
    );
    expect(errors.name).toBeUndefined();
    expect(errors.url).toBeUndefined();
  });
});

describe('createFriendLinkApplication', () => {
  it('校验失败时抛错且不生成申请', () => {
    expect(() => createFriendLinkApplication({ ...validValues, url: '' }, 'example-blog', 'https://github.com/o/r')).toThrow(
      '友链申请信息校验失败。',
    );
  });

  it('成功时返回规范化文件名（自动补 .json）', () => {
    const result = createFriendLinkApplication(validValues, 'example-blog', 'https://github.com/o/r');
    expect(result.filename).toBe('example-blog.json');
    expect(result.values.name).toBe(validValues.name);
  });

  it('文件名已带 .json 时不再重复追加', () => {
    const result = createFriendLinkApplication(validValues, 'Example-Blog.json', 'https://github.com/o/r');
    expect(result.filename).toBe('Example-Blog.json');
  });

  it('issueUrl 包含标题前缀、仓库地址与 URL 编码参数', () => {
    const result = createFriendLinkApplication(validValues, 'example-blog', 'https://github.com/o/r');
    expect(result.issueUrl).toContain('https://github.com/o/r/issues/new');
    // URLSearchParams 把 [ ] 编码为 %5B %5D，空格编码为 +
    expect(result.issueUrl).toContain('%5BFriend+Link%5D');
    expect(result.issueUrl).toContain('body=');
    expect(result.issueUrl).toContain(encodeURIComponent(validValues.name));
  });

  it('仓库地址末尾斜杠被归一化', () => {
    const result = createFriendLinkApplication(validValues, 'example-blog', 'https://github.com/o/r/');
    expect(result.issueUrl.startsWith('https://github.com/o/r/issues/new')).toBe(true);
  });
});
