// @vitest-environment node
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
  /** 写入临时配置文件，返回其路径（由 loadConfig 的 configPath 参数注入）。
   *  传 undefined 表示「文件不存在」场景（返回指向不存在文件的路径）。 */
  const writeTempConfig = (fileContent) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-filter-test-'));
    const configPath = path.join(tempDir, 'comment-keywords.json');
    if (fileContent !== undefined) {
      fs.writeFileSync(configPath, fileContent, 'utf8');
    }
    return configPath;
  };

  /** 路径锚定：默认配置路径独立于 process.cwd()（scripts/lib/ 上两级）。 */
  it('默认配置路径锚定仓库根，不随 cwd 漂移', () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(os.tmpdir());
      const config = loadConfig();
      expect(config).not.toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('仓库内真实配置可加载且结构完整', () => {
    const config = loadConfig();
    expect(config).not.toBeNull();
    expect(config.action).toBe('delete');
    expect(config.keywords.length).toBeGreaterThan(0);
    expect(config.patterns.length).toBeGreaterThan(0);
    expect(config.exemptUsers).toBeInstanceOf(Set);
  });

  it('配置文件缺失时返回 null 并告警', () => {
    const warnings = [];
    const config = loadConfig({ warn: (message) => warnings.push(message) }, writeTempConfig(undefined));
    expect(config).toBeNull();
    expect(warnings.length).toBe(1);
  });

  it('配置 JSON 非法时返回 null 并告警', () => {
    const warnings = [];
    const config = loadConfig({ warn: (message) => warnings.push(message) }, writeTempConfig('{not valid json'));
    expect(config).toBeNull();
    expect(warnings.length).toBe(1);
  });

  it('无关键词与正则时返回 null', () => {
    const config = loadConfig(undefined, writeTempConfig(JSON.stringify({ keywords: [], patterns: [] })));
    expect(config).toBeNull();
  });

  it('非法 action 回退为 minimize（安全默认）', () => {
    const config = loadConfig(undefined, writeTempConfig(JSON.stringify({ action: 'bogus', keywords: ['x'] })));
    expect(config.action).toBe('minimize');
  });

  it('action=delete / none 原样保留；discussionAction 仅接受 none', () => {
    const deleteConfig = loadConfig(
      undefined,
      writeTempConfig(JSON.stringify({ action: 'delete', discussionAction: 'none', keywords: ['x'] })),
    );
    expect(deleteConfig.action).toBe('delete');
    expect(deleteConfig.discussionAction).toBe('none');

    const noneConfig = loadConfig(undefined, writeTempConfig(JSON.stringify({ action: 'none', keywords: ['x'] })));
    expect(noneConfig.action).toBe('none');
    expect(noneConfig.discussionAction).toBe('delete');

    const bogusDiscussion = loadConfig(
      undefined,
      writeTempConfig(JSON.stringify({ action: 'delete', discussionAction: 'hide', keywords: ['x'] })),
    );
    expect(bogusDiscussion.discussionAction).toBe('delete');
  });

  it('非字符串关键词被过滤、空白条目被剔除', () => {
    const config = loadConfig(undefined, writeTempConfig(JSON.stringify({ keywords: [' 有值 ', 42, '', '  '] })));
    expect(config.keywords).toEqual(['有值']);
  });

  it('非法正则被跳过但不影响其余配置', () => {
    const config = loadConfig(
      undefined,
      writeTempConfig(JSON.stringify({ keywords: ['ok'], patterns: ['[invalid', '\\d+'] })),
    );
    expect(config.keywords).toEqual(['ok']);
    expect(config.patterns).toHaveLength(1);
  });
});
