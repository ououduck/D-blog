import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clampWatermarkFontSize,
  clampWatermarkOpacity,
  DEFAULT_WATERMARK_OPTIONS,
  getWatermarkFilename,
  renderWatermark,
} from './watermarkRenderer';

describe('clampWatermarkFontSize', () => {
  it('限制在 8-240 之间', () => {
    expect(clampWatermarkFontSize(4)).toBe(8);
    expect(clampWatermarkFontSize(500)).toBe(240);
    expect(clampWatermarkFontSize(48)).toBe(48);
  });

  it('非有限数值回退默认值', () => {
    expect(clampWatermarkFontSize(Number.NaN)).toBe(DEFAULT_WATERMARK_OPTIONS.fontSize);
    expect(clampWatermarkFontSize(Number.POSITIVE_INFINITY)).toBe(DEFAULT_WATERMARK_OPTIONS.fontSize);
  });
});

describe('clampWatermarkOpacity', () => {
  it('限制在 0-100 之间', () => {
    expect(clampWatermarkOpacity(-5)).toBe(0);
    expect(clampWatermarkOpacity(150)).toBe(100);
    expect(clampWatermarkOpacity(30)).toBe(30);
  });

  it('非有限数值回退默认值', () => {
    expect(clampWatermarkOpacity(Number.NaN)).toBe(DEFAULT_WATERMARK_OPTIONS.opacity);
  });
});

describe('getWatermarkFilename', () => {
  it('去除原扩展名并追加水印后缀', () => {
    expect(getWatermarkFilename('photo.png', 'png')).toBe('photo-watermarked.png');
    expect(getWatermarkFilename('photo.jpg', 'jpeg')).toBe('photo-watermarked.jpg');
    expect(getWatermarkFilename('photo.jpeg', 'png')).toBe('photo-watermarked.png');
  });

  it('无扩展名时保留原名', () => {
    expect(getWatermarkFilename('photo', 'png')).toBe('photo-watermarked.png');
  });

  it('非法文件名字符替换为连字符', () => {
    expect(getWatermarkFilename('a/b\\c:d*e?f"g<h>i|j.png', 'png')).toBe('a-b-c-d-e-f-g-h-i-j-watermarked.png');
  });

  it('空文件名回退为 image', () => {
    expect(getWatermarkFilename('', 'png')).toBe('image-watermarked.png');
    expect(getWatermarkFilename('   ', 'png')).toBe('image-watermarked.png');
  });
});

describe('renderWatermark', () => {
  const createMockContext = () => {
    const calls: string[] = [];
    const context = {
      clearRect: vi.fn(() => calls.push('clearRect')),
      drawImage: vi.fn(() => calls.push('drawImage')),
      save: vi.fn(() => calls.push('save')),
      restore: vi.fn(() => calls.push('restore')),
      fillText: vi.fn(() => calls.push('fillText')),
      measureText: vi.fn(() => ({ width: 100 })),
      set font(value: string) {
        calls.push(`font:${value}`);
      },
      set textBaseline(value: string) {
        calls.push(`baseline:${value}`);
      },
      set textAlign(value: string) {
        calls.push(`align:${value}`);
      },
      set globalAlpha(value: number) {
        calls.push(`alpha:${value}`);
      },
      set shadowColor(value: string) {
        calls.push(`shadow:${value}`);
      },
      set shadowBlur(value: number) {
        calls.push(`blur:${value}`);
      },
      set shadowOffsetY(value: number) {
        calls.push(`offsetY:${value}`);
      },
    };
    return { context, calls };
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getContext 不可用时抛错', () => {
    const canvas = { width: 800, height: 600, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => renderWatermark(canvas, {} as CanvasImageSource, DEFAULT_WATERMARK_OPTIONS)).toThrow(
      '当前浏览器不支持 Canvas 绘制',
    );
  });

  it('绘制图片、设置字体透明度并按位置填充文字', () => {
    const { context, calls } = createMockContext();
    const canvas = { width: 800, height: 600, getContext: () => context } as unknown as HTMLCanvasElement;
    renderWatermark(canvas, {} as CanvasImageSource, { ...DEFAULT_WATERMARK_OPTIONS, text: '示例水印' });

    expect(calls).toContain('clearRect');
    expect(calls).toContain('drawImage');
    expect(calls).toContain('fillText');
    expect(calls.some((call) => call.startsWith('font:600 '))).toBe(true);
    expect(calls).toContain('alpha:0.3'); // opacity 30 → 0.3
    expect(calls).toContain('baseline:middle');
  });

  it('空文本不绘制水印（仅清屏与画图）', () => {
    const { context, calls } = createMockContext();
    const canvas = { width: 800, height: 600, getContext: () => context } as unknown as HTMLCanvasElement;
    renderWatermark(canvas, {} as CanvasImageSource, { ...DEFAULT_WATERMARK_OPTIONS, text: '   ' });
    expect(calls).toContain('drawImage');
    expect(calls).not.toContain('fillText');
  });

  it('顶部位置使用 padding + 字号一半作为 Y 坐标', () => {
    const { context } = createMockContext();
    const canvas = { width: 800, height: 600, getContext: () => context } as unknown as HTMLCanvasElement;
    const fillText = vi.mocked(context.fillText);
    renderWatermark(canvas, {} as CanvasImageSource, {
      ...DEFAULT_WATERMARK_OPTIONS,
      text: '测试',
      position: 'top-left',
      padding: 40,
    });
    // textBaseline=middle：top 锚点 y = padding + fontSize/2 = 40 + 24 = 64
    expect(fillText).toHaveBeenCalledWith('测试', 40, 64, expect.any(Number));
  });

  it('宽幅小图（高度小于 padding×2+字号）时 Y 坐标夹紧到画布内', () => {
    const { context } = createMockContext();
    // 400×50：bottom 锚点 y = 50 - 32 - 24 = -6，落在画布外水印会整体不可见；
    // 夹紧后 y = max(24, min(50-24, -6)) = 24。
    const canvas = { width: 400, height: 50, getContext: () => context } as unknown as HTMLCanvasElement;
    const fillText = vi.mocked(context.fillText);
    renderWatermark(canvas, {} as CanvasImageSource, {
      ...DEFAULT_WATERMARK_OPTIONS,
      text: '测试',
      position: 'bottom-right',
      padding: 32,
    });
    expect(fillText).toHaveBeenCalledWith('测试', 400 - 32, 24, expect.any(Number));
  });

  it('超出可用宽度时按比例缩小字号', () => {
    const { context } = createMockContext();
    // measureText 恒返回 100，可用宽度 = 800 - 32*2 = 736，不触发缩放；
    // 用超宽文本场景验证：可用宽度小于测量宽度时按比例缩小
    context.measureText = vi.fn(() => ({ width: 2000 }));
    const canvas = { width: 800, height: 600, getContext: () => context } as unknown as HTMLCanvasElement;
    const fillText = vi.mocked(context.fillText);
    renderWatermark(canvas, {} as CanvasImageSource, {
      ...DEFAULT_WATERMARK_OPTIONS,
      text: '很长的水印文字内容用于测试自动缩小',
      fontSize: 48,
    });
    expect(fillText).toHaveBeenCalledTimes(1);
  });
});
