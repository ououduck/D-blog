import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isExemptAuthor, loadConfig, matchContent } from './keyword-filter-core.mjs';

describe('matchContent', () => {
  const config = {
    keywords: ['代开发票', 'nmsl'],
    patterns: [/vx\s*[:：]?\s*[a-zA-Z0-9_-]{5,}/i],
  };

  it('命中关键词返回类型与命中的词', () => {
    expect(matchContent(config, '需要代开发票请联系')).toEqual({ type: 'keyword', value: '代开发票' });
  });

  it('大小写不敏感', () => {
    expect(matchContent(config, '你 NMSL')).toEqual({ type: 'keyword', value: 'nmsl' });
  });

  it('命中正则返回 pattern 类型与源码', () => {
    expect(matchContent(config, '联系方式 vx: abc12345')).toEqual({
      type: 'pattern',
      value: 'vx\\s*[:：]?\\s*[a-zA-Z0-9_-]{5,}',
    });
  });

  it('零宽字符被移除后仍能命中（防绕过）', () => {
    expect(matchContent(config, '代\u200b开\u200c发\u200d票')).toEqual({ type: 'keyword', value: '代开发票' });
  });

  it('无命中返回 null', () => {
    expect(matchContent(config, '这是一条正常评论')).toBeNull();
    expect(matchContent(config, '')).toBeNull();
    expect(matchContent(config, null)).toBeNull();
    expect(matchContent(config, undefined)).toBeNull();
  });
});

describe('isExemptAuthor', () => {
  it('giscus 机器人账号自动豁免', () => {
    expect(isExemptAuthor('giscus[bot]', new Set())).toBe(true);
  });

  it('github-actions 机器人账号自动豁免', () => {
    expect(isExemptAuthor('github-actions[bot]', new Set())).toBe(true);
  });

  it('机器人账号大小写不敏感', () => {
    expect(isExemptAuthor('GISCUS[Bot]', new Set())).toBe(true);
  });

  it('配置名单内的用户豁免（小写比较）', () => {
    expect(isExemptAuthor('Duck', new Set(['duck']))).toBe(true);
  });

  it('非豁免用户返回 false', () => {
    expect(isExemptAuthor('random-user', new Set(['duck']))).toBe(false);
    expect(isExemptAuthor('', new Set())).toBe(false);
    expect(isExemptAuthor(null, new Set())).toBe(false);
    expect(isExemptAuthor(undefined, new Set())).toBe(false);
  });
});

describe('loadConfig', () => {
  const originalCwd = process.cwd();

  /** 在临时目录中模拟 config/comment-keywords.json 后恢复 cwd。 */
  const withTempConfig = async (fileContent, callback) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-filter-test-'));
    fs.mkdirSync(path.join(tempDir, 'config'), { recursive: true });
    if (fileContent !== undefined) {
      fs.writeFileSync(path.join(tempDir, 'config', 'comment-keywords.json'), fileContent, 'utf8');
    }
    process.chdir(tempDir);
    try {
      return await callback();
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };

  it('仓库内真实配置可加载且结构完整', () => {
    const config = loadConfig();
    expect(config).not.toBeNull();
    expect(config.action).toBe('delete');
    expect(config.keywords.length).toBeGreaterThan(0);
    expect(config.patterns.length).toBeGreaterThan(0);
    expect(config.exemptUsers).toBeInstanceOf(Set);
  });

  it('配置文件缺失时返回 null 并告警', async () => {
    const warnings = [];
    const config = await withTempConfig(undefined, () => loadConfig({ warn: (message) => warnings.push(message) }));
    expect(config).toBeNull();
    expect(warnings.length).toBe(1);
  });

  it('配置 JSON 非法时返回 null 并告警', async () => {
    const warnings = [];
    const config = await withTempConfig('{not valid json', () =>
      loadConfig({ warn: (message) => warnings.push(message) }),
    );
    expect(config).toBeNull();
    expect(warnings.length).toBe(1);
  });

  it('无关键词与正则时返回 null', async () => {
    const config = await withTempConfig(JSON.stringify({ keywords: [], patterns: [] }), () => loadConfig());
    expect(config).toBeNull();
  });

  it('非法 action 回退为 minimize（安全默认）', async () => {
    const config = await withTempConfig(JSON.stringify({ action: 'bogus', keywords: ['x'] }), () => loadConfig());
    expect(config.action).toBe('minimize');
  });

  it('action=delete / none 原样保留；discussionAction 仅接受 none', async () => {
    const deleteConfig = await withTempConfig(
      JSON.stringify({ action: 'delete', discussionAction: 'none', keywords: ['x'] }),
      () => loadConfig(),
    );
    expect(deleteConfig.action).toBe('delete');
    expect(deleteConfig.discussionAction).toBe('none');

    const noneConfig = await withTempConfig(JSON.stringify({ action: 'none', keywords: ['x'] }), () => loadConfig());
    expect(noneConfig.action).toBe('none');
    expect(noneConfig.discussionAction).toBe('delete');

    const bogusDiscussion = await withTempConfig(
      JSON.stringify({ action: 'delete', discussionAction: 'hide', keywords: ['x'] }),
      () => loadConfig(),
    );
    expect(bogusDiscussion.discussionAction).toBe('delete');
  });

  it('非字符串关键词被过滤、空白条目被剔除', async () => {
    const config = await withTempConfig(JSON.stringify({ keywords: [' 有值 ', 42, '', '  '] }), () => loadConfig());
    expect(config.keywords).toEqual(['有值']);
  });

  it('非法正则被跳过但不影响其余配置', async () => {
    const config = await withTempConfig(JSON.stringify({ keywords: ['ok'], patterns: ['[invalid', '\\d+'] }), () =>
      loadConfig(),
    );
    expect(config.keywords).toEqual(['ok']);
    expect(config.patterns).toHaveLength(1);
  });
});
