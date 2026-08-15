import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadImage, loadImageFile, loadFontFile } from './coverFiles';

const makeFile = (name: string, type: string, size: number): File => {
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
};

// 可控的 FileReader mock：readAsDataURL / readAsArrayBuffer 完成后异步触发 onload。
let fileReaderResult: string | ArrayBuffer | null = null;
let fileReaderError: string | null = null;
let fileReaderAborted = false;

class MockFileReader {
  static EMPTY = 0;
  static LOADING = 1;
  static DONE = 2;
  readyState = MockFileReader.EMPTY;
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  readAsDataURL() {
    this.readyState = MockFileReader.LOADING;
    queueMicrotask(() => {
      if (fileReaderAborted) {
        this.readyState = MockFileReader.EMPTY;
        this.onabort?.();
        return;
      }
      if (fileReaderError) {
        this.onerror?.();
        return;
      }
      this.readyState = MockFileReader.DONE;
      this.result = fileReaderResult;
      this.onload?.();
    });
  }

  readAsArrayBuffer() {
    this.readAsDataURL();
  }

  abort() {
    fileReaderAborted = true;
  }
}

// 可控的 Image mock：src 赋值后按模式触发 onload / onerror。
let imageMode: 'load' | 'error' = 'load';
class MockImage {
  static instances: MockImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  private _src = '';
  constructor() {
    MockImage.instances.push(this);
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (imageMode === 'load') this.onload?.();
      else this.onerror?.();
    });
  }
  get src() {
    return this._src;
  }
}

// 可控的 FontFace mock。
class MockFontFace {
  constructor(
    public family: string,
    public source: string | ArrayBuffer,
    public descriptors?: FontFaceDescriptors,
  ) {}
  load() {
    return Promise.resolve(this as unknown as FontFace);
  }
}

describe('coverFiles 文件校验', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fileReaderResult = 'data:image/png;base64,mock';
    fileReaderError = null;
    fileReaderAborted = false;
    imageMode = 'load';
    MockImage.instances = [];
    vi.stubGlobal('FileReader', MockFileReader);
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('FontFace', MockFontFace);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('合法背景图通过校验并加载', async () => {
    const image = await loadImageFile(makeFile('a.png', 'image/png', 100), 'background');
    expect(image).toBeInstanceOf(MockImage);
  });

  it('拒绝非图片格式', async () => {
    await expect(loadImageFile(makeFile('a.txt', 'text/plain', 100), 'background')).rejects.toThrow(
      '背景图片仅支持 PNG、JPEG 或 WebP 格式',
    );
  });

  it('拒绝超限大小的背景图', async () => {
    await expect(loadImageFile(makeFile('a.png', 'image/png', 11 * 1024 * 1024), 'background')).rejects.toThrow(
      '背景图片大小不能超过',
    );
  });

  it('图标使用更小的体积上限（5MB）', async () => {
    await expect(loadImageFile(makeFile('a.png', 'image/png', 6 * 1024 * 1024), 'icon')).rejects.toThrow(
      '图标大小不能超过',
    );
  });

  it('拒绝不支持的字体格式', async () => {
    await expect(loadFontFile(makeFile('a.css', 'text/css', 100))).rejects.toThrow(
      '字体仅支持 WOFF、WOFF2、TTF 或 OTF 格式',
    );
  });

  it('拒绝超限字体', async () => {
    await expect(loadFontFile(makeFile('a.woff2', 'font/woff2', 11 * 1024 * 1024))).rejects.toThrow('字体大小不能超过');
  });

  it('合法字体通过校验并加载 FontFace', async () => {
    fileReaderResult = new ArrayBuffer(8);
    const font = await loadFontFile(makeFile('a.woff2', 'font/woff2', 100));
    expect(font.family).toBe('CustomFont');
  });

  it('图片加载失败时 reject', async () => {
    imageMode = 'error';
    await expect(loadImageFile(makeFile('a.png', 'image/png', 100), 'background')).rejects.toThrow('图片加载失败');
  });

  it('FileReader 读取失败时 reject', async () => {
    fileReaderError = 'boom';
    await expect(loadImageFile(makeFile('a.png', 'image/png', 100), 'background')).rejects.toThrow('读取文件失败');
  });

  it('loadImage 加载成功 resolve', async () => {
    const promise = loadImage('data:image/png;base64,mock');
    await expect(promise).resolves.toBeInstanceOf(MockImage);
  });
});
