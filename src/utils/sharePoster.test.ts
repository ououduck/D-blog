import { describe, it, expect } from 'vitest';
import { tokenizeText, wrapCanvasText } from './sharePoster';

/**
 * 模拟 canvas 2D context：measureText 宽度按字符数估算（CJK 字符按 2 单位，
 * 其余按 1 单位），与真实排版行为足够接近，可验证换行/截断逻辑。
 */
const createMockCtx = () => {
  const measureText = (text: string) => {
    let width = 0;
    for (const char of text) {
      width += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char) ? 2 : 1;
    }
    return { width } as TextMetrics;
  };
  return { measureText } as unknown as CanvasRenderingContext2D;
};

describe('tokenizeText', () => {
  it('CJK 单字分词', () => {
    expect(tokenizeText('你好世界')).toEqual(['你', '好', '世', '界']);
  });

  it('拉丁连续串保持完整', () => {
    expect(tokenizeText('HelloWorld')).toEqual(['HelloWorld']);
  });

  it('混合中英文正确切分', () => {
    expect(tokenizeText('React 你好 World')).toEqual(['React', ' ', '你', '好', ' ', 'World']);
  });

  it('空格作为独立 token 保留（多空格归一化在 wrapCanvasText 层完成）', () => {
    expect(tokenizeText('a  b')).toEqual(['a', ' ', ' ', 'b']);
  });
});

describe('wrapCanvasText', () => {
  const ctx = createMockCtx();

  it('短文本单行返回', () => {
    expect(wrapCanvasText(ctx, '短文本', 100, 3)).toEqual(['短文本']);
  });

  it('超宽时换行并保留行数上限', () => {
    // 每个 CJK 字符宽 2，maxWidth=8 每行最多 4 个汉字。
    const lines = wrapCanvasText(ctx, '一二三四五六七八九十', 8, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.join('')).toContain('一二三四');
  });

  it('超行数时最后一行追加省略号', () => {
    const lines = wrapCanvasText(ctx, '一二三四五六七八九十', 8, 2);
    expect(lines.length).toBe(2);
    expect(lines[1]).toMatch(/…$/);
    // 前三行内容完整保留（最后一行被截断 + 省略号）。
    expect(lines[0]).toBe('一二三四');
    expect(lines[1]).toMatch(/^五六七/);
  });

  it('超宽单 token（无分隔符长串）逐字截断加省略号', () => {
    // 单个 token 宽度远超 maxWidth：逐字截断（回归：整行画出边界被裁且无省略号）。
    const lines = wrapCanvasText(ctx, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 10, 1);
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatch(/…$/);
    expect(ctx.measureText(lines[0]).width).toBeLessThanOrEqual(10);
  });

  it('中间行被逐字截断时（不只看末行）也返回截断标记', () => {
    // 构造：第一行超宽 token 被截断，末行正常 —— 调用方（标题字号循环）据此
    // 应继续降字号（回归：只看末行会误判字号合适）。
    const lines = wrapCanvasText(ctx, 'aaaaaaa bbbb', 6, 2);
    expect(lines.some((line) => line.endsWith('…'))).toBe(true);
    expect(lines[lines.length - 1]).toBe('bbbb');
  });

  it('空文本返回空数组', () => {
    expect(wrapCanvasText(ctx, '', 100, 3)).toEqual([]);
    expect(wrapCanvasText(ctx, '   ', 100, 3)).toEqual([]);
  });
});
