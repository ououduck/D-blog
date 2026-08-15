/**
 * sharePoster.ts — 分享海报生成（纯前端 Canvas）。
 *
 * 生成一张 750×1334 的竖版海报：站点头部 + 封面图（或渐变占位）+
 * 文章标题/摘要 + 分类与日期 + 二维码卡片。全部在浏览器端绘制，
 * 二维码用 qrcode 库直接画进 canvas（无外链请求，无跨域污染问题）。
 * 封面图走 crossOrigin=anonymous 加载，加载失败时自动回退为渐变占位，
 * 保证海报在任何网络/图床配置下都能生成。
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

const isCjkChar = (char: string) => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u2014\u2018\u2019\u201c\u201d]/.test(char);
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

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
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

/** 加载图片；crossOrigin 加载失败时返回 null，由调用方回退为渐变占位。
 *  不设 crossOrigin 会污染画布导致 toDataURL 抛错，故失败即放弃而非降级重试。 */
const loadImage = (src: string, timeoutMs = 8000): Promise<HTMLImageElement | null> =>
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
    image.crossOrigin = 'anonymous';
    image.src = src;
  });

const drawCoverCrop = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, radius: number) => {
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

export const generateSharePoster = async (options: SharePosterOptions): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = POSTER_WIDTH * PIXEL_RATIO;
  canvas.height = POSTER_HEIGHT * PIXEL_RATIO;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
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

  // ===== 头部：logo + 站点名 + 副标题 =====
  const logo = options.logo ? await loadImage(options.logo) : null;
  const logoSize = 76;
  const headerY = 56;
  const headerTextX = 148;
  if (logo) {
    ctx.save();
    roundRect(ctx, headerY, headerY, logoSize, logoSize, 18);
    ctx.clip();
    ctx.drawImage(logo, headerY, headerY, logoSize, logoSize);
    ctx.restore();
  } else {
    // 无 logo 时画一个圆角方块占位（首字母）。
    ctx.fillStyle = COLORS.chipBg;
    roundRect(ctx, headerY, headerY, logoSize, logoSize, 18);
    ctx.fill();
    ctx.fillStyle = COLORS.chipText;
    ctx.font = `700 40px ${FONT_SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(siteName.charAt(0).toUpperCase(), headerY + logoSize / 2, headerY + logoSize / 2 + 2);
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

  // ===== 封面图 / 渐变占位 =====
  const bandX = 48;
  const bandY = 176;
  const bandWidth = POSTER_WIDTH - 96;
  const bandHeight = 396;
  const bandRadius = 18;
  const coverImage = options.coverImage ? await loadImage(options.coverImage) : null;
  if (coverImage) {
    drawCoverCrop(ctx, coverImage, bandX, bandY, bandWidth, bandHeight, bandRadius);
  } else {
    const gradient = ctx.createLinearGradient(bandX, bandY, bandX, bandY + bandHeight);
    gradient.addColorStop(0, COLORS.bandFrom);
    gradient.addColorStop(1, COLORS.bandTo);
    ctx.fillStyle = gradient;
    roundRect(ctx, bandX, bandY, bandWidth, bandHeight, bandRadius);
    ctx.fill();
    ctx.fillStyle = 'rgba(28, 25, 23, 0.16)';
    ctx.font = `700 88px ${FONT_SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(siteName, POSTER_WIDTH / 2, bandY + bandHeight / 2 + 4);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ===== 标题（最大 4 行）=====
  ctx.font = `700 42px ${FONT_SERIF}`;
  const titleLines = wrapCanvasText(ctx, title, bandWidth, 4);
  const titleLineHeight = 60;
  const titleY = 620;
  ctx.fillStyle = COLORS.ink;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, bandX, titleY + index * titleLineHeight);
  });

  // ===== 摘要（按可用空间自适应 1-3 行）=====
  // 元信息行上限为 970（防止与底部二维码卡片重叠）；标题占位越多，
  // 摘要可用的行数越少，超长摘要自动截断而非与元信息行叠字。
  const excerptY = titleY + titleLines.length * titleLineHeight + 44;
  const META_ROW_LIMIT_Y = 970;
  const EXCERPT_LINE_HEIGHT = 40;
  const META_GAP_Y = 44;
  let excerptLines: string[] = [];
  let metaY = 0;
  if (excerpt) {
    ctx.font = `400 25px ${FONT_SANS}`;
    const availableSpace = META_ROW_LIMIT_Y - excerptY;
    const maxExcerptLines = Math.max(1, Math.min(3, Math.floor((availableSpace - META_GAP_Y) / EXCERPT_LINE_HEIGHT)));
    excerptLines = wrapCanvasText(ctx, excerpt, bandWidth, maxExcerptLines);
    excerptLines.forEach((line, index) => {
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(line, bandX, excerptY + index * EXCERPT_LINE_HEIGHT);
    });
    metaY = Math.min(excerptY + excerptLines.length * EXCERPT_LINE_HEIGHT + META_GAP_Y, META_ROW_LIMIT_Y);
  } else {
    metaY = Math.min(excerptY + 20, META_ROW_LIMIT_Y);
  }

  // ===== 分类 chip + 日期 =====
  if (options.category) {
    ctx.font = `600 22px ${FONT_SANS}`;
    const chipPaddingX = 16;
    const chipHeight = 46;
    const chipTextWidth = ctx.measureText(options.category).width;
    const chipWidth = chipTextWidth + chipPaddingX * 2;
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
    ctx.fillText(options.date, POSTER_WIDTH - bandX, metaY + 28);
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
  ctx.fillText('扫码阅读全文', POSTER_WIDTH / 2, qrY + qrSize + 50);
  if (siteUrl) {
    ctx.fillStyle = COLORS.faint;
    ctx.font = `400 18px ${FONT_MONO}`;
    ctx.fillText(siteUrl.replace(/^https?:\/\//, ''), POSTER_WIDTH / 2, qrY + qrSize + 80);
  }
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
};
