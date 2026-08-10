/**
 * generate-image-assets.mjs — 响应式图片资产生成（sharp 流水线）。
 *
 * 扫描 posts-img/ 下全部图片，为每个可转换格式（png/jpg/jpeg）生成
 * 多宽度 WebP + fallback 变体，输出 public/generated-images/ 与
 * generated/image-assets.json 清单。
 *
 * 生产级重构要点（Phase 1 审计修复）：
 *  1. 有限并发池（默认 4）：避免数百张图片全串行拖慢构建，同时限制
 *     sharp 并发实例数，防止内存峰值过高导致 Runner OOM。
 *  2. 单图失败隔离：单张图片的 sharp 解码/编码失败（损坏文件、超大尺寸、
 *     磁盘空间不足）只记录 warn 并跳过，不再中断整批图片生成 ——
 *     一张坏图不应让整个站点构建失败（原实现会直接抛错终止）。
 *     但输出目录清理/创建失败等基础设施错误仍视为 fatal。
 *  3. 显式依赖注入图片根目录（SOURCE_DIR）便于测试与调试。
 *  4. 顶层异常结构化记录后以非零码退出。
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { createBuildLogger } from './build-logger.mjs';
import { IMAGE_EXTENSIONS } from './image-assets-utils.mjs';

const logger = createBuildLogger('gen:images');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'posts-img');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'generated-images');
const MANIFEST_FILE = path.join(ROOT_DIR, 'generated', 'image-assets.json');

/** 目标变体宽度档位（小于原图宽度才生成，避免放大）。 */
const CANDIDATE_WIDTHS = [320, 640, 960, 1280, 1920];
/** 可转换（生成变体）的源格式。 */
const CONVERTIBLE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
/**
 * 并发处理图片数：限制同时存活的 sharp pipeline 数。
 * 默认 4，可经 IMAGE_CONCURRENCY 环境变量覆盖（低内存 Runner 调小、高配本地调大）。
 * 并发过高会让 sharp 内存峰值失控（每路解码一张 1920px 图约 50-100MB）。
 */
const CONCURRENCY = Math.min(
  16,
  Math.max(1, Number(process.env.IMAGE_CONCURRENCY) || 4)
);

const toPosix = (value) => value.split(path.sep).join('/');
const toPublicUrl = (relativePath) => `/generated-images/${toPosix(relativePath)}`;
const sourceUrl = (relativePath) => `/posts-img/${toPosix(relativePath)}`;

const walkFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? walkFiles(absolutePath)
      : entry.isFile() ? [absolutePath] : [];
  });
};

const ensureSafeOutputPath = (relativePath) => {
  const outputPath = path.resolve(OUTPUT_DIR, relativePath);
  const outputRoot = path.resolve(OUTPUT_DIR);
  if (!outputPath.startsWith(`${outputRoot}${path.sep}`)) {
    throw new Error(`Unsafe generated image path: ${relativePath}`);
  }
  return outputPath;
};

const getVariantWidths = (width) => Array.from(new Set([
  ...CANDIDATE_WIDTHS.filter((candidate) => candidate < width),
  width
])).sort((a, b) => a - b);

const formatExtension = (extension) => extension;

const createVariantPath = (relativePath, width, extension) => {
  const parsed = path.parse(relativePath);
  return path.join(parsed.dir, `${parsed.name}-${width}${extension}`);
};

const writeVariant = async (inputPath, outputPath, width, format) => {
  let pipeline = sharp(inputPath).resize({ width, withoutEnlargement: true });
  if (format === 'webp') {
    pipeline = pipeline.webp({ quality: 82, effort: 4 });
  } else if (format === 'png') {
    pipeline = pipeline.png({ compressionLevel: 9, effort: 8 });
  } else {
    pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
  }
  await pipeline.toFile(outputPath);
};

/**
 * 生成单张图片的资产记录。内部所有 sharp 失败均被捕获：
 * 返回带空 variants 的记录并输出 warn（不抛错），由并发池层统计。
 * @param {string} inputPath 源图片绝对路径。
 * @returns {Promise<object>} 资产记录（url/source/width/height/variants）。
 */
const generateAsset = async (inputPath) => {
  const relativePath = path.relative(SOURCE_DIR, inputPath);
  const url = sourceUrl(relativePath);
  const extension = path.extname(relativePath).toLowerCase();

  let metadata;
  try {
    metadata = await sharp(inputPath).metadata();
  } catch (error) {
    logger.warn('Unable to read image metadata', `${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return { url, source: url, width: undefined, height: undefined, variants: { webp: [], fallback: [] } };
  }
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    logger.warn('Image has no readable dimensions', relativePath);
    return { url, source: url, width: undefined, height: undefined, variants: { webp: [], fallback: [] } };
  }

  if (!CONVERTIBLE_EXTENSIONS.has(extension)) {
    return { url, source: url, width, height, variants: { webp: [], fallback: [] } };
  }

  const fallbackExtension = formatExtension(extension);
  const variants = { webp: [], fallback: [] };
  try {
    for (const variantWidth of getVariantWidths(width)) {
      const webpRelativePath = createVariantPath(relativePath, variantWidth, '.webp');
      const fallbackRelativePath = createVariantPath(relativePath, variantWidth, fallbackExtension);
      const webpPath = ensureSafeOutputPath(webpRelativePath);
      const fallbackPath = ensureSafeOutputPath(fallbackRelativePath);
      fs.mkdirSync(path.dirname(webpPath), { recursive: true });
      await writeVariant(inputPath, webpPath, variantWidth, 'webp');
      await writeVariant(inputPath, fallbackPath, variantWidth, extension === '.png' ? 'png' : 'jpeg');
      variants.webp.push({ url: toPublicUrl(webpRelativePath), width: variantWidth });
      variants.fallback.push({ url: toPublicUrl(fallbackRelativePath), width: variantWidth });
    }
  } catch (error) {
    // 单图变体生成失败（磁盘满、超大像素、编码异常）：跳过该图，不中断整批。
    logger.warn('Variant generation failed, skipping image', `${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
    return { url, source: url, width, height, variants: { webp: [], fallback: [] } };
  }

  return { url, source: url, width, height, variants };
};

/**
 * 简单并发池：并发执行 worker，任何单个任务失败由 worker 内部消化
 * （本文件所有 worker 均不抛错），池本身只负责调度。
 * @param {Array} items
 * @param {(item: any, index: number) => Promise<void>} worker
 * @returns {Promise<void>}
 */
const runPool = async (items, worker) => {
  let cursor = 0;
  const workers = [];
  for (let slot = 0; slot < Math.min(CONCURRENCY, items.length); slot += 1) {
    workers.push((async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        await worker(items[index], index);
      }
    })());
  }
  await Promise.all(workers);
};

export const generateImageAssets = async () => {
  logger.start('Generate responsive image assets');
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Image source directory not found: ${SOURCE_DIR}`);
  }

  // 基础设施操作（清理/创建目录）：失败即 fatal（后续写入必然失败）。
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true });

  const imageFiles = walkFiles(SOURCE_DIR).filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()));
  const assets = {};
  let skipped = 0;

  await runPool(imageFiles, async (filePath) => {
    const asset = await generateAsset(filePath);
    assets[asset.url] = asset;
    // 记录"未能生成任何变体"的图片（含不可读元数据/不可转换格式以外的失败）。
    if (asset.variants.webp.length === 0 && CONVERTIBLE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
      skipped += 1;
    }
  });

  const manifest = { version: 1, assets };
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  const variantCount = Object.values(assets).reduce((sum, asset) => sum + asset.variants.webp.length, 0);
  logger.step('Generated image manifest', `assets=${Object.keys(assets).length} variants=${variantCount} skipped=${skipped}`);
  logger.summary({ assets: Object.keys(assets).length, output: 'public/generated-images' });
  return manifest;
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  generateImageAssets().catch((error) => {
    logger.error('Image generation failed', error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
