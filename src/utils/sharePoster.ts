/**
 * sharePoster.ts — 分享海报生成（纯前端 Canvas）。
 *
 * 生成一张 750×1334 的竖版海报：站点头部（真实 LOGO）+ 眉标分类 + 自适应排版的
 * 大标题/摘要 + 日期元信息 + 二维码卡片。内容块在头部分割线与底部二维码卡片之间
 * 垂直均匀分布（留白自动分摊），无封面图。全部在浏览器端绘制，二维码用 qrcode
 * 库直接画进 canvas（无外链请求，无跨域污染问题）。
 *
 * 图片加载策略（仅站点头部 logo）：
 * 1. 先按 crossOrigin=anonymous 直连加载（同源资源、已开 CORS 的图床直接命中）；
 * 2. 同源资源失败时去掉 crossOrigin 重试一次（同源绘制不会污染画布）；
 * 3. 跨域图床（如 img.pldduck.com 未开 CORS）无法安全读取，最终回退品牌占位。
 * 全部失败才回退为品牌占位，保证海报始终能生成。
 */

interface SharePosterOptions {
  title: string;
  excerpt: string;
  url: string;
  category?: string;
  date?: string;
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
};

const FONT_SERIF = '"Playfair Display","Noto Serif SC","Songti SC","SimSun",serif';
const FONT_SANS = '-apple-system,"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
const FONT_MONO = '"SF Mono","Consolas","Liberation Mono",monospace';

const isCjkChar = (char: string) =>
  /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\u2014\u2018\u2019\u201c\u201d]/.test(char);
const isLatinRun = (char: string) => /[A-Za-z0-9]/.test(char);

/** 按 CJK 单字 / 拉丁连续串分词，支持混合中英文的自然换行（导出供单元测试）。 */
export const tokenizeText = (text: string): string[] => {
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
 * 返回每行文本数组（已去除行首多余空白）。导出供单元测试（该函数经历两轮
 * 截断 bug 修复，需要直接回归覆盖）。
 */
export const wrapCanvasText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] => {
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

  // 单 token 比 maxWidth 还宽（无分隔符的超长连续串，如长序列号/长单词）时，
  // 上方换行逻辑无法拆分行（首 token 时 currentLine 为空不触发换行），整行
  // 会画出海报边界被裁切且无省略号。对每行做逐字截断兜底。
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (ctx.measureText(line).width <= maxWidth) {
      continue;
    }
    let truncated = line;
    while (truncated && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    lines[index] = `${truncated}…`;
  }

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

/** 多级加载：直连 → 同源去 crossOrigin 重试（跨域图床未开 CORS 时最终回退品牌占位）。 */
const loadImage = (src: string, timeoutMs = 8000): Promise<HTMLImageElement | null> => {
  const direct = loadImageOnce(src, true, timeoutMs);
  return direct.then((image) => {
    if (image) return image;
    if (isSameOriginSrc(src)) {
      // 同源图片本就不需要 CORS，去掉 crossOrigin 再试一次（不会污染画布）。
      return loadImageOnce(src, false, timeoutMs);
    }
    // 跨域图床未开 CORS：浏览器禁止跨域读取（画布会被污染），回退品牌占位。
    return null;
  });
};

// ───────────────────────── 绘制辅助 ─────────────────────────

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

  // 纸感点阵纹理（全幅、低透明度），承接原封面占位的纸张质感。
  ctx.save();
  ctx.fillStyle = 'rgba(28, 25, 23, 0.035)';
  const dotSpacing = 34;
  for (let py = 34; py < POSTER_HEIGHT; py += dotSpacing) {
    for (let px = 30; px < POSTER_WIDTH; px += dotSpacing) {
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

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

  // ===== 内容区：眉标分类 + 大标题 + 强调线 + 摘要 + 日期元信息 =====
  // 封面图已移除：内容块整体置于头部分割线与底部二维码卡片之间，间隙留白按块
  // 均匀分摊——内容短时版面舒展、内容长时自动收紧且不会压到二维码卡片。
  const marginX = 48;
  const contentWidth = POSTER_WIDTH - marginX * 2;
  const bandTop = 208;
  const bandBottom = 990;
  const category = options.category || '';
  const date = options.date || '';

  // 1) 标题：自适应字号（越短越大），最多 4 行。
  const titleCandidates = [54, 50, 46, 42, 38, 34, 30];
  let titleFontSize = 30;
  let titleLines: string[] = [];
  for (const size of titleCandidates) {
    ctx.font = `700 ${size}px ${FONT_SERIF}`;
    const lines = wrapCanvasText(ctx, title, contentWidth, 4);
    titleFontSize = size;
    titleLines = lines;
    // 只有所有行都未被截断（任一行都不以 … 结尾）才认为该字号能完整放下；
    // 只看末行会把"中间行被逐字截断兜底"（wrapCanvasText 内超宽 token 分支）
    // 误判为字号合适，导致大字号时中间行省略号、小字号本可完整放下。
    if (!lines.some((line) => line.endsWith('…'))) break;
  }
  const titleLineHeight = Math.round(titleFontSize * 1.4);
  const titleBlockHeight = titleLines.length * titleLineHeight;

  // 2) 摘要：按剩余空间自适应 1-4 行，超长自动截断而非叠字。
  const KICKER_HEIGHT = 44;
  const RULE_HEIGHT = 6;
  const EXCERPT_LINE_HEIGHT = 42;
  const EXCERPT_FONT_SIZE = 27;
  let excerptLines: string[] = [];
  if (excerpt) {
    ctx.font = `400 ${EXCERPT_FONT_SIZE}px ${FONT_SANS}`;
    const fixedAboveExcerpt =
      bandTop + 40 + (category ? KICKER_HEIGHT + 34 : 0) + titleBlockHeight + 32 + RULE_HEIGHT + 34;
    const maxExcerptLines = Math.max(
      1,
      Math.min(4, Math.floor((bandBottom - fixedAboveExcerpt - 44 - 30) / EXCERPT_LINE_HEIGHT)),
    );
    excerptLines = wrapCanvasText(ctx, excerpt, contentWidth, maxExcerptLines);
  }

  // 3) 内容块堆叠：固定最小间距 + 均匀分摊剩余留白。
  const sections: { height: number; gapBefore: number; draw: (top: number) => void }[] = [];
  if (category) {
    sections.push({
      height: KICKER_HEIGHT,
      gapBefore: 40,
      draw: (top) => {
        ctx.font = `600 22px ${FONT_SANS}`;
        const chipPaddingX = 18;
        const chipTextWidth = ctx.measureText(category).width;
        const chipWidth = Math.min(chipTextWidth + chipPaddingX * 2, 320);
        ctx.fillStyle = COLORS.chipBg;
        roundRect(ctx, marginX, top, chipWidth, KICKER_HEIGHT, KICKER_HEIGHT / 2);
        ctx.fill();
        ctx.fillStyle = COLORS.chipText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(category, marginX + chipWidth / 2, top + KICKER_HEIGHT / 2 + 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      },
    });
  }
  sections.push({
    height: titleBlockHeight,
    gapBefore: category ? 34 : 40,
    draw: (top) => {
      ctx.font = `700 ${titleFontSize}px ${FONT_SERIF}`;
      ctx.fillStyle = COLORS.ink;
      titleLines.forEach((line, index) => {
        ctx.fillText(line, marginX, top + index * titleLineHeight);
      });
    },
  });
  sections.push({
    height: RULE_HEIGHT,
    gapBefore: 32,
    draw: (top) => {
      // 标题下短强调线：杂志式排版锚点，承接原封面图的位置视觉。
      ctx.fillStyle = COLORS.ink;
      roundRect(ctx, marginX, top, 88, RULE_HEIGHT, RULE_HEIGHT / 2);
      ctx.fill();
    },
  });
  if (excerptLines.length > 0) {
    sections.push({
      height: excerptLines.length * EXCERPT_LINE_HEIGHT,
      gapBefore: 34,
      draw: (top) => {
        ctx.font = `400 ${EXCERPT_FONT_SIZE}px ${FONT_SANS}`;
        ctx.fillStyle = COLORS.muted;
        excerptLines.forEach((line, index) => {
          ctx.fillText(line, marginX, top + index * EXCERPT_LINE_HEIGHT);
        });
      },
    });
  }
  if (date) {
    sections.push({
      height: 30,
      gapBefore: 44,
      draw: (top) => {
        // 细分割线分隔正文与元信息行；左侧站点名、右侧日期。
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marginX, top - 26);
        ctx.lineTo(marginX + contentWidth, top - 26);
        ctx.stroke();
        ctx.fillStyle = COLORS.faint;
        ctx.font = `600 20px ${FONT_SANS}`;
        ctx.textAlign = 'left';
        ctx.fillText(siteName, marginX, top + 30);
        ctx.fillStyle = COLORS.muted;
        ctx.font = `400 22px ${FONT_MONO}`;
        ctx.textAlign = 'right';
        ctx.fillText(date, POSTER_WIDTH - marginX, top + 30);
        ctx.textAlign = 'left';
      },
    });
  }

  const totalStackHeight = sections.reduce((sum, section) => sum + section.gapBefore + section.height, 0);
  const extraSpace = Math.max(0, bandBottom - bandTop - totalStackHeight);
  // 留白均匀分摊到各块间距；单块最多吸收 56px，余量留给底部（二维码卡片上方）。
  const extraPerGap = Math.min(extraSpace / sections.length, 56);
  let cursorY = bandTop;
  for (const section of sections) {
    cursorY += section.gapBefore + extraPerGap;
    section.draw(cursorY);
    cursorY += section.height;
  }

  // ===== 二维码卡片（底部固定区域）=====
  const qrCardWidth = 240;
  const qrCardHeight = 276;
  const qrSize = 188;
  const qrX = (POSTER_WIDTH - qrCardWidth) / 2;
  // 底部锚定：内容再短也保持卡片位置稳定，内容超长时由上方内容区下限（bandBottom）兜底。
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
