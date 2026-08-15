import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyTextToClipboard } from './clipboard';

// jsdom 未实现 document.execCommand：测试前显式定义。
const mockExecCommand = (result: boolean) => {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: vi.fn(() => result),
  });
};

describe('copyTextToClipboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('优先使用 Clipboard API（安全上下文）', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyTextToClipboard('你好')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('你好');
  });

  it('Clipboard API 拒绝时回退 execCommand', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) },
    });
    mockExecCommand(true);
    await expect(copyTextToClipboard('回退文本')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('无 Clipboard API 时使用 execCommand', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('navigator', {});
    mockExecCommand(true);
    await expect(copyTextToClipboard('文本')).resolves.toBe(true);
    expect(document.execCommand).toHaveBeenCalled();
  });

  it('execCommand 失败返回 false', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.stubGlobal('navigator', {});
    mockExecCommand(false);
    await expect(copyTextToClipboard('文本')).resolves.toBe(false);
  });
});
