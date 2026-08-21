// @vitest-environment node
/**
 * PagesCMS（.pages.yml）友链集合配置回归测试。
 *
 * 背景：新建友链报 `Invalid extension "" for content "friends"`。
 * 根因：原模板 `filename: "{fields.name}.json"` 会把站点名 slugify 后作为文件名，
 * 纯中文站点名（如「垃圾桶」）经 slugify(lower+strict) 得到空串，文件名退化为
 * `.json` 点文件；PagesCMS 的 getFileExtension(".json") 返回空串，与 schema 扩展名
 * "json" 不匹配，服务端在创建/读取/重命名/历史记录时统一抛该错误。
 *
 * 修复：文件名改由独立的 filename 字段（ASCII slug）生成，模板固定为
 * `{fields.filename}.json`，字段必填且 pattern 限制为 `^[A-Za-z0-9_-]+$`。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesConfig = yaml.load(readFileSync(path.join(repoRoot, '.pages.yml'), 'utf8'));

const friendsCollection = pagesConfig.content.find((item) => item.name === 'friends');

describe('PagesCMS friends 集合：filename 模板与字段约束', () => {
  it('filename 模板固定为 "{fields.filename}.json"（不依赖中文站点名）', () => {
    expect(friendsCollection?.filename).toBe('{fields.filename}.json');
  });

  it('filename 字段已定义、必填，且 pattern 限制为 ASCII slug 字符', () => {
    const field = friendsCollection?.fields.find((f) => f.name === 'filename');
    expect(field?.type).toBe('string');
    expect(field?.required).toBe(true);
    expect(field?.pattern).toEqual({
      regex: '^[A-Za-z0-9_-]+$',
      message: expect.any(String),
    });
  });

  it('filename 模板引用的字段必须存在于 fields 中', () => {
    const names = new Set(friendsCollection.fields.map((f) => f.name));
    for (const match of friendsCollection.filename.matchAll(/\{fields\.([^}]+)\}/g)) {
      expect(names.has(match[1])).toBe(true);
    }
  });

  it('模板渲染结果始终保留 ".json" 扩展名（纯中文站点名也不退化为点文件）', () => {
    // 模拟 PagesCMS generateFilename 的字段替换：{fields.<name>} 取表单值，
    // 中文/非 ASCII 字符在 slugify(lower+strict) 后全部被剥离。
    const slugifyLike = (value) =>
      String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const render = (template, values) =>
      template.replace(/\{(?:fields\.)?([^}]+)\}/g, (_, key) => slugifyLike(values[key] ?? ''));

    // 修复前：{fields.name}.json + 纯中文名 → ".json"（getFileExtension 返回 "" → 报错）。
    expect(render('{fields.name}.json', { name: '垃圾桶' })).toBe('.json');

    // 修复后：文件名来自 filename 字段，纯中文站点名不影响扩展名。
    const filename = render(friendsCollection.filename, { filename: 'my-blog', name: '垃圾桶' });
    expect(filename).toBe('my-blog.json');
    expect(/\.json$/.test(filename)).toBe(true);
  });
});
