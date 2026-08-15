/**
 * sharePoster.ts — 分享海报生成（纯前端 Canvas）。
 *
 * 生成一张 750×1334 的竖版海报：站点头部（真实 LOGO）+ 封面图（或品牌占位）+
 * 自适应排版的标题/摘要 + 分类与日期 + 二维码卡片。全部在浏览器端绘制，
 * 二维码用 qrcode 库直接画进 canvas（无外链请求，无跨域污染问题）。
 *
 * 图片加载策略（保证海报在任何网络/图床配置下都能生成）：
 * 1. 先按 crossOrigin=anonymous 直连加载（同源资源、已开 CORS 的图床直接命中）；
 * 2. 同源资源失败时去掉 crossOrigin 重试一次（同源绘制不会污染画布）；
 * 3. 跨域图床（如 img.pldduck.com 未开 CORS）失败时，改走同源代理
 *    /img-proxy?url=...（生产环境由 Pages 边缘函数提供，开发环境由 Vite
 *    中间件模拟），代理响应自带 CORS 头，画布可安全导出。
 * 全部失败才回退为品牌占位，保证海报始终能生成。
 */

interface SharePosterOptions {
  title: string;
  excerpt: string;
  url: string;
  category?: string;
  date?: string;
  coverImage?: string;
  siteName?: string;
  siteSubtitle?: string;
  siteUrl?: string;
  logo?: string;
}

const POSTER_WIDTH = 750;
const POSTER_HEIGHT = 1334;
const PIXEL_RATIO = 2;

const COLORS = {
  bg: '#f7f5ef',
  card: '#ffffff',
  ink: '#1c1917',
  muted: '#78716c',
  faint: '#a8a29e',
  line: '#e7e3d9',
  chipBg: '#1c1917',
  chipText: '#fafaf9',
  qrDark: '#1c1917',
  qrLight: '#ffffff',
  bandFrom: '#e7e3d9',
  bandTo: '#f1eee6',
};

const FONT_SERIF = '"Playfair Display","Noto Serif SC","Songti SC","SimSun",serif';
const FONT_SANS = '-apple-system,"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
const FONT_MONO = '"SF Mono","Consolas","Liberation Mono",monospace';

const isCjkChar = (char: string) =>
  /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u2014\u2018\u2019\u201c\u201d]/.test(char);
const isLatinRun = (char: string) => /[A-Za-z0-9]/.test(char);

/** 按 CJK 单字 / 拉丁连续串分词，支持混合中英文的自然换行。 */
const tokenizeText = (text: string): string[] => {
  const tokens: string[] = [];
  let latinBuffer = '';
  const flushLatin = () => {
    if (latinBuffer) {
      tokens.push(latinBuffer);
      latinBuffer = '';
    }
  };
  for (const char of text) {
    if (isCjkChar(char)) {
      flushLatin();
      tokens.push(char);
    } else if (isLatinRun(char)) {
      latinBuffer += char;
    } else {
      flushLatin();
      tokens.push(char);
    }
  }
  flushLatin();
  return tokens;
};

/**
 * 在 canvas 上按最大宽度 + 最大行数排版文本，超长行截断加省略号。
 * 返回每行文本数组（已去除行首多余空白）。
 */
const wrapCanvasText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] => {
  const lines: string[] = [];
  let currentLine = '';
  const tokens = tokenizeText(text.replace(/\s+/g, ' ').trim());

  // 允许压入 maxLines + 1 行：最后一行作为“溢出哨兵”，
  // 使下方 lines.length > maxLines 的截断加省略号逻辑得以触发。
  const pushLine = (line: string) => {
    if (lines.length <= maxLines) lines.push(line);
  };

  for (const token of tokens) {
    const candidate = currentLine ? `${currentLine}${token}` : token;
    if (ctx.measureText(candidate).width > maxWidth && currentLine) {
      pushLine(currentLine.trimEnd());
      currentLine = token.trimStart();
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine.trimEnd()) pushLine(currentLine.trimEnd());

  // 超出最大行数时，最后一行截断并追加省略号。
  if (lines.length > maxLines) {
    const last = lines[maxLines - 1];
    let truncated = last;
    while (truncated && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    lines.length = maxLines - 1;
    lines.push(`${truncated}…`);
  }
  return lines;
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

/** 等比缩放并居中绘制图片（contain），避免非正方形 logo 被拉伸变形。 */
const drawImageContain = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};

// ───────────────────────── 图片加载（直连 + 同源重试 + 代理兜底） ─────────────────────────

/** 单次加载：失败返回 null（crossOrigin 加载失败即放弃，避免污染画布）。 */
const loadImageOnce = (src: string, useCrossOrigin: boolean, timeoutMs: number): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const image = new Image();
    let settled = false;
    const finish = (value: HTMLImageElement | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    image.onload = () => {
      window.clearTimeout(timer);
      finish(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    if (useCrossOrigin) {
      image.crossOrigin = 'anonymous';
    }
    image.src = src;
  });

const isSameOriginSrc = (src: string): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
};

// 代理固定挂在站点根路径：Cloudflare/EdgeOne Pages 的边缘函数始终部署在域名根，
// 不随 VITE_BASE_PATH 子路径移动，因此这里不能走 assetUrl（会拼上 base path）。
const toProxyUrl = (src: string): string => `/img-proxy?url=${encodeURIComponent(src)}`;

/** 多级加载：直连 → 同源去 crossOrigin 重试 → 跨域走同源代理。 */
const loadImage = (src: string, timeoutMs = 8000): Promise<HTMLImageElement | null> => {
  const direct = loadImageOnce(src, true, timeoutMs);
  return direct.then((image) => {
    if (image) return image;
    if (isSameOriginSrc(src)) {
      // 同源图片本就不需要 CORS，去掉 crossOrigin 再试一次（不会污染画布）。
      return loadImageOnce(src, false, timeoutMs);
    }
    // 跨域图床未开 CORS：经同源代理转发（生产环境由 Pages 边缘函数提供）。
    return loadImageOnce(toProxyUrl(src), true, timeoutMs);
  });
};

// ───────────────────────── 绘制辅助 ─────────────────────────

const drawCoverCrop = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x - (drawWidth - width) / 2, y - (drawHeight - height) / 2, drawWidth, drawHeight);
  ctx.restore();
  // 封面描边，与暗色页面风格一致。
  ctx.strokeStyle = 'rgba(28, 25, 23, 0.14)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, radius);
  ctx.stroke();
};

/** 封面占位：渐变 + 点阵纹理 + 居中站点标志（替代原“大字站名”的粗糙占位）。 */
const drawCoverFallback = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  logo: HTMLImageElement | null,
  siteName: string,
) => {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, COLORS.bandFrom);
  gradient.addColorStop(1, COLORS.bandTo);
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();

  // 点阵纹理（低透明度，营造纸张质感）。
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.fillStyle = 'rgba(28, 25, 23, 0.05)';
  const spacing = 26;
  for (let py = y + 22; py < y + height - 12; py += spacing) {
    for (let px = x + 22; px < x + width - 12; px += spacing) {
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  const centerX = x + width / 2;
  const centerY = y + height / 2;
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawImageContain(ctx, logo, centerX - 48, centerY - 64, 96, 96);
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(28, 25, 23, 0.42)';
  ctx.font = `600 30px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(siteName, centerX, centerY + (logo ? 52 : 0));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
};

/** 头部 logo 占位：纸色圆角块 + 细描边 + 低透明度首字母（不再使用黑底白字色块）。 */
const drawLogoFallback = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, siteName: string) => {
  ctx.save();
  ctx.fillStyle = COLORS.card;
  roundRect(ctx, x, y, size, size, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(28, 25, 23, 0.14)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, size, size, 18);
  ctx.stroke();
  ctx.fillStyle = 'rgba(28, 25, 23, 0.38)';
  ctx.font = `700 34px ${FONT_SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((siteName || 'D').charAt(0).toUpperCase(), x + size / 2, y + size / 2 + 2);
  ctx.restore();
};

// ───────────────────────── 主流程 ─────────────────────────

export const generateSharePoster = async (options: SharePosterOptions): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH * PIXEL_RATIO;
  canvas.height = POSTER_HEIGHT * PIXEL_RATIO;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D 上下文不可用');
  }
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

  // 等待字体（Playfair Display / 系统字体）就绪，避免绘制时回退到默认字体。
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // 字体加载失败不阻塞海报生成。
    }
  }

  const title = options.title.trim() || '未命名文章';
  const excerpt = options.excerpt.trim() || '';
  const siteName = options.siteName || 'D-blog';
  const siteSubtitle = options.siteSubtitle || '';
  const siteUrl = options.siteUrl || '';
  const qrUrl = options.url;

  // ===== 背景 =====
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  // 右上角装饰：半透明大号站点名水印。
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 190px ${FONT_SERIF}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(siteName, POSTER_WIDTH - 20, 96);
  ctx.restore();

  // ===== 头部：真实 LOGO + 站点名 + 副标题 =====
  const logo = options.logo ? await loadImage(options.logo) : null;
  const logoSize = 76;
  const headerY = 56;
  const headerTextX = 148;
  if (logo) {
    ctx.save();
    roundRect(ctx, headerY, headerY, logoSize, logoSize, 18);
    ctx.clip();
    // 等比缩放居中绘制，避免 logo 非正方形时被拉伸。
    drawImageContain(ctx, logo, headerY, headerY, logoSize, logoSize);
    ctx.restore();
  } else {
    drawLogoFallback(ctx, headerY, headerY, logoSize, siteName);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 38px ${FONT_SERIF}`;
  ctx.fillText(siteName, headerTextX, headerY + 34);
  if (siteSubtitle) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `400 21px ${FONT_SANS}`;
    ctx.fillText(siteSubtitle, headerTextX, headerY + 64);
  }
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, headerY + logoSize + 36);
  ctx.lineTo(POSTER_WIDTH - 48, headerY + logoSize + 36);
  ctx.stroke();

  // ===== 封面图 / 品牌占位 =====
  const bandX = 48;
  const bandY = 176;
  const bandWidth = POSTER_WIDTH - 96;
  const bandHeight = 396;
  const bandRadius = 18;
  const coverImage = options.coverImage ? await loadImage(options.coverImage) : null;
  if (coverImage) {
    drawCoverCrop(ctx, coverImage, bandX, bandY, bandWidth, bandHeight, bandRadius);
  } else {
    drawCoverFallback(ctx, bandX, bandY, bandWidth, bandHeight, bandRadius, logo, siteName);
  }

  // ===== 标题：自适应字号（越短越大），最多 3 行 =====
  const titleY = bandY + bandHeight + 48;
  const titleCandidates = [46, 42, 38, 34];
  let titleFontSize = 34;
  let titleLines: string[] = [];
  for (const size of titleCandidates) {
    ctx.font = `700 ${size}px ${FONT_SERIF}`;
    const lines = wrapCanvasText(ctx, title, bandWidth, 3);
    titleFontSize = size;
    titleLines = lines;
    // wrapCanvasText 恒返回 ≤3 行，超长时最后一行以省略号截断；
    // 仅当未被截断（末行不以 … 结尾）时说明该字号能完整放下，停止降字号。
    if (!lines[lines.length - 1]?.endsWith('…')) break;
  }
  const titleLineHeight = Math.round(titleFontSize * 1.42);
  ctx.fillStyle = COLORS.ink;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, bandX, titleY + index * titleLineHeight);
  });

  // ===== 摘要（按可用空间自适应 1-3 行）=====
  // 元信息行顶部上限 940：与底部二维码卡片（顶部 1032）之间保留安全间距，
  // 标题/摘要占位越多，摘要可用的行数越少，超长摘要自动截断而非叠字。
  const excerptY = titleY + titleLines.length * titleLineHeight + 36;
  const CONTENT_LIMIT_Y = 940;
  const EXCERPT_LINE_HEIGHT = 40;
  const META_GAP_Y = 40;
  let excerptLines: string[] = [];
  let metaY = 0;
  if (excerpt) {
    ctx.font = `400 26px ${FONT_SANS}`;
    const availableSpace = CONTENT_LIMIT_Y - excerptY - META_GAP_Y;
    const maxExcerptLines = Math.max(1, Math.min(3, Math.floor(availableSpace / EXCERPT_LINE_HEIGHT)));
    excerptLines = wrapCanvasText(ctx, excerpt, bandWidth, maxExcerptLines);
    excerptLines.forEach((line, index) => {
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(line, bandX, excerptY + index * EXCERPT_LINE_HEIGHT);
    });
    metaY = Math.min(excerptY + excerptLines.length * EXCERPT_LINE_HEIGHT + META_GAP_Y, CONTENT_LIMIT_Y);
  } else {
    metaY = Math.min(excerptY + 28, CONTENT_LIMIT_Y);
  }

  // ===== 分类 chip + 日期（细分割线分隔正文与元信息）=====
  if (options.category || options.date) {
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bandX, metaY - 24);
    ctx.lineTo(bandX + bandWidth, metaY - 24);
    ctx.stroke();
  }
  if (options.category) {
    ctx.font = `600 22px ${FONT_SANS}`;
    const chipPaddingX = 16;
    const chipHeight = 46;
    const chipTextWidth = ctx.measureText(options.category).width;
    const chipWidth = Math.min(chipTextWidth + chipPaddingX * 2, 360);
    ctx.fillStyle = COLORS.chipBg;
    roundRect(ctx, bandX, metaY, chipWidth, chipHeight, chipHeight / 2);
    ctx.fill();
    ctx.fillStyle = COLORS.chipText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.category, bandX + chipWidth / 2, metaY + chipHeight / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  if (options.date) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `400 22px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(options.date, POSTER_WIDTH - bandX, metaY + 30);
    ctx.textAlign = 'left';
  }

  // ===== 二维码卡片（底部固定区域）=====
  const qrCardWidth = 240;
  const qrCardHeight = 276;
  const qrSize = 188;
  const qrX = (POSTER_WIDTH - qrCardWidth) / 2;
  // 底部锚定：内容再短也保持卡片位置稳定，内容超长时由上方 metaY 截断兜底。
  const qrY = POSTER_HEIGHT - qrCardHeight - 26;

  ctx.save();
  ctx.shadowColor = 'rgba(28, 25, 23, 0.10)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = COLORS.card;
  roundRect(ctx, qrX, qrY, qrCardWidth, qrCardHeight, 24);
  ctx.fill();
  ctx.restore();

  const { default: QRCode } = await import('qrcode');
  const qrCanvas = document.createElement('canvas');
  qrCanvas.width = qrSize;
  qrCanvas.height = qrSize;
  await QRCode.toCanvas(qrCanvas, qrUrl, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: COLORS.qrDark, light: COLORS.qrLight },
  });
  ctx.drawImage(qrCanvas, (POSTER_WIDTH - qrSize) / 2, qrY + 18, qrSize, qrSize);

  ctx.fillStyle = COLORS.ink;
  ctx.font = `600 22px ${FONT_SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('扫码阅读全文', POSTER_WIDTH / 2, qrY + qrSize + 46);
  if (siteUrl) {
    ctx.fillStyle = COLORS.faint;
    ctx.font = `400 18px ${FONT_MONO}`;
    ctx.fillText(siteUrl.replace(/^https?:\/\//, ''), POSTER_WIDTH / 2, qrY + qrSize + 74);
  }
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
};
