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
const CANDIDATE_WIDTHS = [320, 640, 960, 1280, 1920];
const CONVERTIBLE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

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
    return { url, source: url, width: undefined, height: undefined, variants: { webp: [], fallback: [] } };
  }

  if (!CONVERTIBLE_EXTENSIONS.has(extension)) {
    return {
      url,
      source: url,
      width,
      height,
      variants: { webp: [], fallback: [] }
    };
  }

  const fallbackExtension = formatExtension(extension);
  const variants = { webp: [], fallback: [] };
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

  return { url, source: url, width, height, variants };
};

export const generateImageAssets = async () => {
  logger.start('Generate responsive image assets');
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Image source directory not found: ${SOURCE_DIR}`);
  }

  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST_FILE), { recursive: true });

  const imageFiles = walkFiles(SOURCE_DIR).filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()));
  const assets = {};
  for (const filePath of imageFiles) {
    const asset = await generateAsset(filePath);
    assets[asset.url] = asset;
  }

  const manifest = { version: 1, assets };
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  logger.step('Generated image manifest', `assets=${Object.keys(assets).length} variants=${Object.values(assets).reduce((sum, asset) => sum + asset.variants.webp.length, 0)}`);
  logger.summary({ assets: Object.keys(assets).length, output: 'public/generated-images' });
  return manifest;
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  generateImageAssets().catch((error) => {
    logger.error('Image generation failed', error.message);
    process.exitCode = 1;
  });
}
