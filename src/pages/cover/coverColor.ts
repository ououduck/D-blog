/**
 * 封面配色工具：解析主题色并决策文字颜色（白/深蓝），保证与背景的对比度
 * 达到可读阈值（WCAG 近似），提供纯函数便于单元测试。
 */
type RgbColor = { r: number; g: number; b: number };

interface ColorDecision {
  color: '#ffffff' | '#1a1a2e';
  contrast: number;
  lowContrast: boolean;
}

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function parseColor(value: string): RgbColor | null {
  const input = value.trim().toLowerCase();
  const hex = input.match(/^#([\da-f]{3,8})$/i);
  if (hex) {
    const raw = hex[1];
    const expanded =
      raw.length <= 4
        ? raw
            .split('')
            .map((char) => char + char)
            .join('')
        : raw;
    if (expanded.length < 6) return null;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
    };
  }
  const rgb = input.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) return { r: clampChannel(Number(rgb[1])), g: clampChannel(Number(rgb[2])), b: clampChannel(Number(rgb[3])) };
  const named: Record<string, RgbColor> = {
    black: { r: 0, g: 0, b: 0 },
    white: { r: 255, g: 255, b: 255 },
    transparent: { r: 255, g: 255, b: 255 },
  };
  return named[input] ?? null;
}

function relativeLuminance(color: RgbColor): number {
  const linear = [color.r, color.g, color.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: RgbColor, second: RgbColor): number {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

export function chooseTextColor(background: RgbColor | null, fallback: string): ColorDecision {
  const fallbackColor = parseColor(fallback) ?? { r: 0, g: 0, b: 0 };
  if (!background) {
    const whiteContrast = contrastRatio({ r: 255, g: 255, b: 255 }, fallbackColor);
    const darkContrast = contrastRatio({ r: 26, g: 26, b: 46 }, fallbackColor);
    const color = whiteContrast >= darkContrast ? '#ffffff' : '#1a1a2e';
    return { color, contrast: Math.max(whiteContrast, darkContrast), lowContrast: false };
  }
  const whiteContrast = contrastRatio({ r: 255, g: 255, b: 255 }, background);
  const darkContrast = contrastRatio({ r: 26, g: 26, b: 46 }, background);
  const contrast = Math.max(whiteContrast, darkContrast);
  return { color: whiteContrast >= darkContrast ? '#ffffff' : '#1a1a2e', contrast, lowContrast: contrast < 4.5 };
}

export function sampleRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): RgbColor | null {
  try {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const left = Math.max(0, Math.floor(x));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(canvasWidth, Math.ceil(x + width));
    const bottom = Math.min(canvasHeight, Math.ceil(y + height));
    if (right <= left || bottom <= top) return null;
    const data = ctx.getImageData(left, top, right - left, bottom - top).data;
    // 网格抽样：每 stride 像素取一点（行/列双步进，16× 降本）。autoTextColor
    // 默认开启、预览拖拽/输入时对每块文本频繁触发，逐像素遍历（icon-split 三块
    // 共约 36 万像素）成本高；网格均值对纯色/渐变背景足够稳定。
    const rowWidth = right - left;
    const stride = 4;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let row = 0; row < bottom - top; row += stride) {
      const rowOffset = row * rowWidth * 4;
      for (let col = 0; col < rowWidth; col += stride) {
        const offset = rowOffset + col * 4;
        const alpha = data[offset + 3] / 255;
        if (alpha < 0.05) continue;
        r += data[offset] * alpha;
        g += data[offset + 1] * alpha;
        b += data[offset + 2] * alpha;
        count += alpha;
      }
    }
    return count ? { r: r / count, g: g / count, b: b / count } : null;
  } catch {
    return null;
  }
}
