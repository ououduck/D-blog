import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadCachedImage, preloadImage } from './coverImageCache';
import { canvasToBlob, downloadCanvas, copyCanvas, downloadBlob } from './coverExport';

describe('coverImageCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('首次加载创建 promise 并缓存', async () => {
    const image = {} as HTMLImageElement;
    vi.spyOn(await import('./coverFiles'), 'loadImage').mockResolvedValue(image);
    const first = loadCachedImage('data:image/png;base64,x');
    const second = loadCachedImage('data:image/png;base64,x');
    expect(first).toBe(second); // 同一 URL 复用缓存 promise
    await expect(first).resolves.toBe(image);
  });

  it('不同 URL 独立缓存', () => {
    const first = loadCachedImage('data:image/png;base64,a');
    const second = loadCachedImage('data:image/png;base64,b');
    expect(first).not.toBe(second);
  });

  it('preloadImage 委托给缓存加载', () => {
    const p = preloadImage('data:image/png;base64,c');
    expect(p).toBe(loadCachedImage('data:image/png;base64,c'));
  });
});

describe('coverExport', () => {
  const makeCanvas = (blob: Blob | null, tainted = false) =>
    ({
      toBlob: (cb: (b: Blob | null) => void) => cb(blob),
      toDataURL: () => {
        if (tainted) {
          throw new DOMException('The canvas has been tainted by cross-origin data.', 'SecurityError');
        }
        return 'data:image/png;base64,';
      },
    }) as unknown as HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: vi.fn(() => 'blob:mock') });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: vi.fn() });
    vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('canvasToBlob 成功回调 resolve blob', async () => {
    const blob = new Blob(['x']);
    await expect(canvasToBlob(makeCanvas(blob), 'image/png')).resolves.toBe(blob);
  });

  it('canvasToBlob 空结果 reject', async () => {
    await expect(canvasToBlob(makeCanvas(null), 'image/png')).rejects.toThrow('图片编码失败');
  });

  it('downloadCanvas 触发下载链接', async () => {
    const blob = new Blob(['x']);
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    await downloadCanvas(makeCanvas(blob), 'cover.png', 'png');
    expect(appendSpy).toHaveBeenCalled();
  });

  it('downloadBlob 触发下载', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    downloadBlob(new Blob(['x']), 'batch.zip');
    expect(appendSpy).toHaveBeenCalled();
  });

  it('copyCanvas 无 ClipboardItem 时抛错', async () => {
    await expect(copyCanvas(makeCanvas(new Blob(['x'])), 'png')).rejects.toThrow('不支持复制图片');
  });

  it('copyCanvas 原生复制成功返回 native', async () => {
    vi.stubGlobal('ClipboardItem', class {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: vi.fn(async () => {}) },
    });
    const result = await copyCanvas(makeCanvas(new Blob(['x'])), 'png');
    expect(result).toBe('native');
  });

  it('copyCanvas JPEG 失败回退 PNG', async () => {
    vi.stubGlobal('ClipboardItem', class {});
    const write = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    const result = await copyCanvas(makeCanvas(new Blob(['x'])), 'jpeg');
    expect(result).toBe('png-fallback');
  });
});
