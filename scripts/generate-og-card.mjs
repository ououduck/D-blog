/**
 * 生成全站默认社交分享卡片（1200×630）。
 *
 * 需求背景：og:image / twitter:image 的推荐尺寸为 1200×630（1.91:1），
 * 此前默认使用 logo.png（1024×987，近正方形），在微信/Telegram/X 等平台的
 * 分享预览会被裁切。本脚本在构建期基于 public/logo.png 生成品牌化分享卡片，
 * 纯构建期运行（复用已有 sharp 依赖），无任何运行时开销。
 *
 * 设计：纸感渐变背景 + 居中 logo。刻意不叠加文字，
 * 避免引入中文字体文件（CJK 字体在构建期不可用且体积巨大）。
 * 生成逻辑与站点现状（matters 构建脚本）一致：失败即抛错，阻断构建。
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');
const LOGO_PATH = path.join(PUBLIC_DIR, 'logo.png');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'og-card.png');

// 与站内 .dark 主题下的纸张背景观感一致的暖纸渐变。
const CARD_BG_TOP = '#f2f0e9';
const CARD_BG_BOTTOM = '#e8e2d6';

// 视觉权重：卡片中 logo 的近似目标宽度（约 1/3 卡片宽度）。
const LOGO_TARGET_WIDTH = 400;

const run = async () => {
  if (!fs.existsSync(LOGO_PATH)) {
    throw new Error(`generate-og-card: logo not found at ${LOGO_PATH}`);
  }

  const logo = sharp(LOGO_PATH);
  const metadata = await logo.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('generate-og-card: cannot read logo dimensions');
  }

  const logoHeight = Math.round(LOGO_TARGET_WIDTH * (metadata.height / metadata.width));

  // 生成品牌化分享卡片：从 logo 中心取最大内接正方形，
  // 缩放为期望尺寸后叠加到纸张渐变背景中央，输出 1200×630 PNG。
  const svgBackground = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">`,
    `<defs>`,
    `<linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0" stop-color="${CARD_BG_TOP}" />`,
    `<stop offset="1" stop-color="${CARD_BG_BOTTOM}" />`,
    `</linearGradient>`,
    `</defs>`,
    `<rect width="1200" height="630" fill="url(#paper)" />`,
    `</svg>`,
  ].join('');

  const cardBackground = sharp(Buffer.from(svgBackground)).png();
  const logoSquare = await logo
    .resize({
      width: LOGO_TARGET_WIDTH,
      height: logoHeight,
      fit: 'contain',
      position: 'centre',
      background: { r: 0xff, g: 0xff, b: 0xff, alpha: 0 },
    })
    .png()
    .toBuffer();

  await cardBackground
    .composite([
      {
        input: logoSquare,
        top: Math.round((630 - logoHeight) / 2),
        left: Math.round((1200 - LOGO_TARGET_WIDTH) / 2),
      },
    ])
    .png()
    .toFile(OUTPUT_PATH);

  const result = await sharp(OUTPUT_PATH).metadata();
  console.log(`[gen:og-card] generated ${path.relative(process.cwd(), OUTPUT_PATH)} ${result.width}x${result.height}`);
};

run().catch((error) => {
  console.error(`[gen:og-card] ${error.message}`);
  process.exitCode = 1;
});
