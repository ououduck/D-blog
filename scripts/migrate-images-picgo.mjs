/**
 * migrate-images-picgo.mjs — 将文章（含封面）的本地图片通过 PicGo 上传至图床并替换链接。
 *
 * 用法：
 *   node scripts/migrate-images-picgo.mjs [目标文件夹] [--dry-run]
 *
 * 默认扫描 posts/ 目录下所有 .md 文件（递归子目录）。
 * --dry-run：只打印将要上传和替换的内容，不实际上传、不写文件。
 *
 * PicGo 接口：POST http://127.0.0.1:36677/upload
 *   Body: { "list": ["绝对路径1", "绝对路径2"] }
 *   返回: { "success": true, "result": ["线上URL1", "线上URL2"] }
 *
 * 设计要点：
 *  1. 解析 frontmatter coverImage + 正文 Markdown `![](path)` + HTML `<img src="path">`。
 *  2. 屏蔽围栏代码块，避免误收集代码中的路径。
 *  3. 跳过已是外链（http(s)://、//）的路径；校验本地文件存在。
 *  4. 全局去重缓存（绝对路径 → URL）：同一图片跨多篇/多次引用只上传一次。
 *  5. 每篇 MD 的新图片批量上传，返回 URL 后对原文做字符串替换（frontmatter + 正文 + 嵌套链接一并替换）。
 *
 * 注意：正式模式会对 .md 文件原地写回（非原子、无备份）。执行前请确认
 * 工作区已提交（git status 干净）或已备份，便于误替换后 git 还原。
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const PICGO_URL = 'http://127.0.0.1:36677/upload';
const PICGO_TIMEOUT_MS = 120_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const targetArg = args.find((arg) => !arg.startsWith('--'));
const TARGET_DIR = path.resolve(ROOT_DIR, targetArg || 'posts');

// ── 日志辅助 ──────────────────────────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, value) => (useColor ? `\u001B[${code}m${value}\u001B[0m` : value);
const green = (v) => paint('32', v);
const yellow = (v) => paint('33', v);
const red = (v) => paint('31', v);
const cyan = (v) => paint('36', v);
const dim = (v) => paint('2', v);

// ── 递归遍历 .md 文件 ──────────────────────────────────────
const walkMarkdownFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdownFiles(absolutePath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) return [absolutePath];
    return [];
  });
};

// ── 屏蔽围栏代码块（``` 包裹） ────────────────────────────
// 将代码块内容替换为等长空格串，保留换行，避免正则误匹配代码中的图片路径。
// 收集阶段使用屏蔽后的内容；替换阶段操作原文。
const maskFencedCode = (content) => {
  let result = '';
  let index = 0;
  while (index < content.length) {
    const fenceMatch = content.slice(index).match(/^```[^\n]*\n/);
    if (fenceMatch) {
      const fenceStart = index + fenceMatch[0].length;
      const closeIndex = content.indexOf('\n```', fenceStart);
      const codeEnd = closeIndex < 0 ? content.length : closeIndex;
      // 围栏行本身保留原文，代码体替换为空格（保留换行）。
      result += fenceMatch[0];
      for (let i = fenceStart; i < codeEnd; i += 1) {
        result += content[i] === '\n' ? '\n' : ' ';
      }
      if (closeIndex >= 0) {
        result += content.slice(codeEnd, codeEnd + 4); // '\n```'
        index = codeEnd + 4;
      } else {
        index = content.length;
      }
    } else {
      // 找下一个 ``` 起点
      const nextFence = content.indexOf('```', index + 1);
      if (nextFence < 0) {
        result += content.slice(index);
        break;
      }
      result += content.slice(index, nextFence);
      index = nextFence;
    }
  }
  return result;
};

// ── 判断是否外链 ──────────────────────────────────────────
const isExternalUrl = (value) => {
  const trimmed = String(value ?? '')
    .trim()
    .replace(/^<|>$/g, '');
  return /^(?:https?:)?\/\//i.test(trimmed);
};

// ── 解析图片路径字符串 ─────────────────────────────────────
// 返回 Set<原始路径字符串>（去重）。
const extractImagePathStrings = (frontmatterData, bodyContent) => {
  const paths = new Set();
  const masked = maskFencedCode(bodyContent);

  // 1. frontmatter coverImage
  const cover = frontmatterData?.coverImage;
  if (typeof cover === 'string' && cover.trim()) {
    paths.add(cover.trim());
  }

  // 2. Markdown 图片 ![alt](url "title") — url 是括号内首个非空白 token
  const mdImageRe = /!\[[^\]]*\]\(\s*(<[^)>]*>|[^)\s>]+)\s*[^)]*\)/g;
  let match;
  while ((match = mdImageRe.exec(masked)) !== null) {
    const raw = match[1].replace(/^<|>$/g, '').trim();
    if (raw) paths.add(raw);
  }

  // 3. HTML <img ... src="url"> — 含单/双引号
  const htmlSrcRe = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
  while ((match = htmlSrcRe.exec(masked)) !== null) {
    const raw = match[1].trim();
    if (raw) paths.add(raw);
  }

  return paths;
};

// ── 将路径字符串解析为本地绝对文件路径 ────────────────────
// 返回 null 表示外链或无法解析。
const resolveLocalPath = (rawPath, fileDir) => {
  const clean = rawPath
    .replace(/^<|>$/g, '')
    .replace(/[?#].*$/, '')
    .replace(/\\/g, '/')
    .trim();
  if (!clean || isExternalUrl(clean)) return null;

  // 站内绝对路径：/xxx → <root>/xxx
  if (clean.startsWith('/')) {
    return path.resolve(ROOT_DIR, `.${clean}`);
  }

  // 相对路径：基于 MD 文件目录解析
  return path.resolve(fileDir, clean);
};

// ── 调用 PicGo 批量上传 ───────────────────────────────────
const uploadViaPicgo = async (absolutePaths) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PICGO_TIMEOUT_MS);

  try {
    const response = await fetch(PICGO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: absolutePaths }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`PicGo 返回 HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(`PicGo 上传失败：${JSON.stringify(data)}`);
    }

    const results = data.result;
    if (!Array.isArray(results) || results.length !== absolutePaths.length) {
      throw new Error(
        `PicGo 返回结果数量 ${Array.isArray(results) ? results.length : 'N/A'} 与上传数量 ${absolutePaths.length} 不匹配`,
      );
    }

    return results;
  } finally {
    clearTimeout(timer);
  }
};

// ── 主流程 ────────────────────────────────────────────────
const main = async () => {
  console.log(cyan('━'.repeat(60)));
  console.log(cyan('  PicGo 图片迁移脚本'));
  console.log(`${cyan('  目标目录:')} ${TARGET_DIR}`);
  console.log(
    `${cyan('  模式:')} ${isDryRun ? yellow('dry-run（预览，不上传不写文件）') : green('实际执行（上传 + 替换）')}`,
  );
  console.log(cyan('━'.repeat(60)));

  const mdFiles = walkMarkdownFiles(TARGET_DIR);
  if (mdFiles.length === 0) {
    console.log(yellow(`未在 ${TARGET_DIR} 找到 .md 文件`));
    return;
  }
  console.log(`找到 ${green(mdFiles.length)} 个 Markdown 文件\n`);

  // 全局缓存：绝对路径 → 线上 URL（跨文件去重，同一图片只上传一次）
  const uploadCache = new Map();
  let totalUploaded = 0;
  let totalReplaced = 0;
  let totalFilesChanged = 0;
  const warnings = [];

  for (const mdFile of mdFiles) {
    const relativeFile = path.relative(ROOT_DIR, mdFile);
    const rawContent = fs.readFileSync(mdFile, 'utf-8');
    const parsed = matter(rawContent);
    const fileDir = path.dirname(mdFile);

    // 收集所有图片路径字符串
    const pathStrings = extractImagePathStrings(parsed.data, parsed.content);

    // 分类：外链（跳过）、本地存在（待替换）、本地缺失（警告）
    const replacements = []; // { raw: 原始路径字符串, url: 线上URL }
    const pendingUpload = []; // { abs: 绝对路径 }
    let hasLocalForThisFile = false;

    for (const raw of pathStrings) {
      if (isExternalUrl(raw)) continue; // 已是外链，跳过
      hasLocalForThisFile = true;

      const abs = resolveLocalPath(raw, fileDir);
      if (!abs) {
        warnings.push(`${relativeFile}: 无法解析路径 "${raw}"（非外链也非本地）`);
        continue;
      }
      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        warnings.push(`${relativeFile}: 本地图片不存在 "${raw}" → ${path.relative(ROOT_DIR, abs)}`);
        continue;
      }

      // 命中全局缓存：直接使用已上传的 URL
      if (uploadCache.has(abs)) {
        replacements.push({ raw, url: uploadCache.get(abs) });
      } else {
        pendingUpload.push({ raw, abs });
      }
    }

    if (!hasLocalForThisFile) {
      console.log(`${dim(relativeFile)} — 无本地图片，跳过`);
      continue;
    }

    // 批量上传本文件的新图片
    if (pendingUpload.length > 0) {
      const absPaths = pendingUpload.map((item) => item.abs);

      if (isDryRun) {
        console.log(`\n${cyan(relativeFile)}`);
        console.log(`  ${yellow('[待上传]')} ${absPaths.length} 张图片:`);
        for (const item of pendingUpload) {
          console.log(`    ${dim(path.relative(ROOT_DIR, item.abs))}`);
          console.log(`      ← "${item.raw}"`);
        }
        // dry-run 模式下假设上传成功，用占位 URL 预览替换效果
        for (const item of pendingUpload) {
          const placeholder = `https://cdn.example.com/${encodeURIComponent(path.basename(item.abs))}`;
          uploadCache.set(item.abs, placeholder);
          replacements.push({ raw: item.raw, url: placeholder });
        }
      } else {
        console.log(`\n${cyan(relativeFile)} — 上传 ${absPaths.length} 张图片...`);
        const urls = await uploadViaPicgo(absPaths);
        absPaths.forEach((abs, index) => uploadCache.set(abs, urls[index]));
        totalUploaded += absPaths.length;
        replacements.push(...pendingUpload.map((item, index) => ({ raw: item.raw, url: urls[index] })));
        console.log(`  ${green('✓')} 上传完成`);
        for (const item of pendingUpload) {
          const url = uploadCache.get(item.abs);
          console.log(`    ${dim(path.relative(ROOT_DIR, item.abs))} → ${url}`);
        }
      }
    } else if (replacements.length > 0 && !isDryRun) {
      console.log(`${dim(relativeFile)} — ${replacements.length} 处引用均命中缓存，无需上传`);
    }

    // 执行字符串替换（按路径长度降序，避免子串误伤）
    if (replacements.length === 0) {
      continue;
    }

    if (isDryRun) {
      console.log(`  ${yellow('[待替换]')} ${replacements.length} 处路径:`);
      for (const { raw, url } of replacements) {
        console.log(`    "${raw}" → ${url}`);
      }
      continue;
    }

    // 实际替换：去重同一路径字符串（同一文件内可能多处引用同一字符串），
    // 按长度降序构造单遍正则，只对原始文本扫描一次。
    // 不要逐条 split/join 累积替换：PicGo URL 常包含原文件名，短路径会把
    // 刚插入的 URL 内部再替换一遍（如 "a.png" → "https://…/a.png" 被二次破坏），
    // 单遍替换中插入的 URL 不会参与后续匹配，可彻底避免该污染。
    const uniqueReplacements = [...new Map(replacements.map((item) => [item.raw, item.url])).entries()]
      .map(([raw, url]) => ({ raw, url }))
      .sort((a, b) => b.raw.length - a.raw.length);

    const escapedPattern = new RegExp(
      uniqueReplacements.map(({ raw }) => raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
      'g',
    );
    const newContent = rawContent.replace(escapedPattern, (match) => {
      const item = uniqueReplacements.find(({ raw }) => raw === match);
      return item ? item.url : match;
    });

    if (newContent !== rawContent) {
      fs.writeFileSync(mdFile, newContent, 'utf-8');
      totalFilesChanged += 1;
      totalReplaced += uniqueReplacements.length;
    }
  }

  // 汇总
  console.log(`\n${cyan('━'.repeat(60))}`);
  console.log(cyan('  迁移汇总'));
  console.log(`${cyan('  模式:')} ${isDryRun ? yellow('dry-run') : green('实际执行')}`);
  console.log(`${cyan('  扫描文件:')} ${mdFiles.length}`);
  console.log(
    `${cyan('  上传图片:')} ${isDryRun ? yellow(`${uploadCache.size}（dry-run 未实际上传）`) : green(totalUploaded)}`,
  );
  console.log(`${cyan('  修改文件:')} ${isDryRun ? dim('N/A（dry-run）') : green(totalFilesChanged)}`);
  console.log(`${cyan('  替换路径:')} ${isDryRun ? dim('见上方预览') : green(totalReplaced)}`);
  if (warnings.length > 0) {
    console.log(`\n${yellow('  ⚠ 警告')} (${warnings.length}):`);
    warnings.forEach((warning) => console.log(`    ${yellow(warning)}`));
  }
  console.log(cyan('━'.repeat(60)));
};

main().catch((error) => {
  console.error(red(`\n✗ 迁移失败: ${error instanceof Error ? error.message : String(error)}`));
  if (error instanceof Error && error.cause) {
    console.error(red(`  原因: ${error.cause.message || error.cause}`));
  }
  process.exit(1);
});
