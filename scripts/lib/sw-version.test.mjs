// @vitest-environment node
/**
 * sw-version.mjs 单测：版本号计算稳定性/敏感性与 dist/sw.js 补丁幂等性。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { computeServiceWorkerVersion, patchServiceWorkerVersion } from './sw-version.mjs';

let distDir;

const writeSw = (content = "const SW_VERSION = 'dblog-v10';\nconsole.log(SW_VERSION);\n") => {
  fs.writeFileSync(path.join(distDir, 'sw.js'), content);
};

describe('sw-version', () => {
  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'swver-'));
    fs.mkdirSync(path.join(distDir, 'assets'));
  });

  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('相同产物清单 → 相同版本号（确定性）', () => {
    fs.writeFileSync(path.join(distDir, 'assets', 'index-abc123.js'), '');
    expect(computeServiceWorkerVersion(distDir)).toBe(computeServiceWorkerVersion(distDir));
  });

  it('产物文件名变化 → 版本号变化（含子目录与排序无关性）', () => {
    fs.writeFileSync(path.join(distDir, 'assets', 'index-aaa.js'), '');
    const before = computeServiceWorkerVersion(distDir);

    fs.writeFileSync(path.join(distDir, 'assets', 'index-bbb.js'), '');
    fs.mkdirSync(path.join(distDir, 'assets', 'chunks'));
    fs.writeFileSync(path.join(distDir, 'assets', 'chunks', 'x-def456.js'), '');
    const after = computeServiceWorkerVersion(distDir);
    expect(after).not.toBe(before);
    // 子目录文件以 POSIX 相对路径参与计算
    expect(after).toMatch(/^dblog-[0-9a-f]{12}$/);
  });

  it('patchServiceWorkerVersion 替换 SW_VERSION 常量并幂等报错防重复打补丁', () => {
    writeSw();
    const version = patchServiceWorkerVersion(distDir);
    expect(version).toMatch(/^dblog-[0-9a-f]{12}$/);
    const patched = fs.readFileSync(path.join(distDir, 'sw.js'), 'utf-8');
    expect(patched).toContain(`const SW_VERSION = '${version}';`);

    // 再打一次：占位符已不存在 → 抛错（避免静默重复打补丁掩盖异常）。
    expect(() => patchServiceWorkerVersion(distDir)).toThrow(/SW_VERSION/);
  });

  it('sw.js 缺失占位符时抛错阻断构建', () => {
    fs.writeFileSync(path.join(distDir, 'sw.js'), 'no placeholder here');
    expect(() => patchServiceWorkerVersion(distDir)).toThrow(/SW_VERSION/);
  });
});
