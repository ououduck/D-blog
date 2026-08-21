// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseApplication, writeFriendFile } from './friend-link-bot.mjs';

describe('parseApplication 续行折叠', () => {
  const base = [
    '- Site Name: 测试博客',
    '- Site URL: https://example.com',
    '- Friend Page URL: https://example.com/friends',
    '- Avatar URL: https://example.com/avatar.png',
    '- Your Name / Contact: 张三',
    '- Filename: test',
  ];

  it('缩进续行折叠进字段值', () => {
    const body = [...base.slice(0, 4), '- Short Description: 第一行', '  第二行续写', ...base.slice(4)].join('\n');
    const result = parseApplication(body);
    expect(result?.description).toContain('第一行');
    expect(result?.description).toContain('第二行续写');
  });

  it('缩进子列表项（-foo 无空格标记）不折叠进字段值', () => {
    const body = [...base.slice(0, 4), '- Short Description: 描述', '  -foo 子项', ...base.slice(4)].join('\n');
    const result = parseApplication(body);
    expect(result?.description).toBe('描述');
  });

  it('数字列表（1. 条目）不折叠进字段值', () => {
    const body = [...base.slice(0, 4), '- Short Description: 描述', '  1. 条目', ...base.slice(4)].join('\n');
    const result = parseApplication(body);
    expect(result?.description).toBe('描述');
  });
});

describe('writeFriendFile 写入 filename 键（PagesCMS 编辑兼容）', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'friend-bot-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const application = {
    name: '测试博客',
    url: 'https://example.com',
    friendPageUrl: 'https://example.com/friends',
    avatar: 'https://example.com/avatar.png',
    description: '描述',
    contact: '张三',
    filename: 'test-blog',
  };

  it('写入的文件包含与文件名一致的 filename 键（无 .json 后缀）', async () => {
    const filePath = await writeFriendFile(application, tempDir);
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(path.basename(filePath)).toBe('test-blog.json');
    expect(data.filename).toBe('test-blog');
    expect(data.name).toBe('测试博客');
    expect(data.url).toBe('https://example.com');
  });

  it('filename 自带 .json 后缀时，filename 键存储为去后缀的 stem', async () => {
    const filePath = await writeFriendFile({ ...application, filename: 'my-site.json' }, tempDir);
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(path.basename(filePath)).toBe('my-site.json');
    expect(data.filename).toBe('my-site');
  });
});
