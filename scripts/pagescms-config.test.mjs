// @vitest-environment node
/**
 * PagesCMS（.pages.yml）集合配置回归测试。
 *
 * 背景：新建友链报 `Invalid extension "" for content "friends"`。
 * 根因：原模板 `filename: "{fields.name}.json"` 会把站点名 slugify 后作为文件名，
 * 纯中文站点名（如「垃圾桶」）经 slugify(lower+strict) 得到空串，文件名退化为
 * `.json` 点文件；PagesCMS 的 getFileExtension(".json") 返回空串，与 schema 扩展名
 * "json" 不匹配，服务端在创建/读取/重命名/历史记录时统一抛该错误。posts/shuoshuo
 * 的 `{fields.id}.md` 模板存在同类隐患（id 填中文同样退化出 ".md" 点文件）。
 *
 * 修复：文件名/URL 标识统一由独立的 ASCII slug 字段生成（friends 的 filename、
 * posts/shuoshuo 的 id），模板固定保留扩展名，slug 字段必填且 pattern 限制为
 * `^[A-Za-z0-9_-]+$`。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesConfig = yaml.load(readFileSync(path.join(repoRoot, '.pages.yml'), 'utf8'));

const SLUG_PATTERN = '^[A-Za-z0-9_-]+$';

/** 各集合的「文件名生成字段」约定：模板应引用该字段，且该字段必填 + pattern 校验。 */
const collections = [
  { name: 'friends', filenameTemplate: '{fields.filename}.json', slugField: 'filename' },
  { name: 'posts', filenameTemplate: '{fields.id}.md', slugField: 'id' },
  { name: 'shuoshuo', filenameTemplate: '{fields.id}.md', slugField: 'id' },
];

describe('PagesCMS 集合：filename 模板与 slug 字段约束（回归：Invalid extension ""）', () => {
  for (const { name, filenameTemplate, slugField } of collections) {
    const collection = pagesConfig.content.find((item) => item.name === name);

    describe(`${name} 集合`, () => {
      it(`filename 模板固定为 ${JSON.stringify(filenameTemplate)}`, () => {
        expect(collection?.filename).toBe(filenameTemplate);
      });

      it(`${slugField} 字段必填且 pattern 限制为 ASCII slug 字符`, () => {
        const field = collection?.fields.find((f) => f.name === slugField);
        expect(field?.type).toBe('string');
        expect(field?.required).toBe(true);
        expect(field?.pattern).toEqual({
          regex: SLUG_PATTERN,
          message: expect.any(String),
        });
      });

      it('filename 模板引用的字段必须存在于 fields 中', () => {
        const names = new Set(collection.fields.map((f) => f.name));
        for (const match of collection.filename.matchAll(/\{fields\.([^}]+)\}/g)) {
          expect(names.has(match[1])).toBe(true);
        }
      });

      it('模板渲染结果始终保留扩展名（纯中文输入也不退化为点文件）', () => {
        // 模拟 PagesCMS generateFilename 的字段替换：{fields.<name>} 取表单值，
        // 中文/非 ASCII 字符在 slugify(lower+strict) 后全部被剥离。
        const slugifyLike = (value) =>
          String(value ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const render = (template, values) =>
          template.replace(/\{(?:fields\.)?([^}]+)\}/g, (_, key) => slugifyLike(values[key] ?? ''));

        // 修复前：slug 字段填中文 → 空串 → ".json"/".md" 点文件（getFileExtension 返回 "" → 报错）。
        expect(render('{fields.name}.json', { name: '垃圾桶' })).toBe('.json');
        expect(render('{fields.id}.md', { id: '我的文章' })).toBe('.md');

        // 修复后：文件名来自 slug 字段，纯中文的其他字段不影响扩展名。
        // 注：posts/shuoshuo 的 slug 字段本身就是 id，故只注入 slug 字段与 name。
        const rendered = render(collection.filename, {
          [slugField]: 'my-slug',
          name: '垃圾桶',
        });
        expect(rendered).toBe(`my-slug${filenameTemplate.slice(filenameTemplate.lastIndexOf('.'))}`);
        expect(/\.(json|md)$/.test(rendered)).toBe(true);
      });
    });
  }
});
