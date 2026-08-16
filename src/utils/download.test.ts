import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from './download';

describe('downloadBlob', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: vi.fn(() => 'blob:mock') });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: vi.fn() });
    vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, 'remove').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('创建 object URL 并触发下载', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const blob = new Blob(['content'], { type: 'text/plain' });
    downloadBlob(blob, 'file.txt');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalled();
    expect(HTMLElement.prototype.click).toHaveBeenCalled();
    const link = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe('file.txt');
    expect(link.href).toBe('blob:mock');
  });

  it('延迟 revoke object URL（默认 1000ms）', () => {
    vi.useFakeTimers();
    downloadBlob(new Blob(['x']), 'a.txt');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('支持自定义 revoke 延迟', () => {
    vi.useFakeTimers();
    downloadBlob(new Blob(['x']), 'a.txt', 100);
    vi.advanceTimersByTime(100);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
