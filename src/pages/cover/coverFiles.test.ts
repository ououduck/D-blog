import { describe, expect, it } from 'vitest';
import { validateFontFile, validateImageFile } from './coverFiles';

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('cover file validation', () => {
  it('accepts supported background and icon images', () => {
    expect(validateImageFile(file('background.webp', 'image/webp', 10), 'background').name).toBe('background.webp');
    expect(validateImageFile(file('icon.png', 'image/png', 10), 'icon').name).toBe('icon.png');
  });

  it('rejects unsupported and oversized images with Chinese errors', () => {
    expect(() => validateImageFile(file('image.gif', 'image/gif', 10), 'background')).toThrow('仅支持 PNG、JPEG 或 WebP');
    expect(() => validateImageFile(file('icon.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1), 'icon')).toThrow('5MB');
    expect(() => validateImageFile(file('background.jpg', 'image/jpeg', 10 * 1024 * 1024 + 1), 'background')).toThrow('10MB');
  });

  it('accepts supported font MIME types or extensions', () => {
    expect(validateFontFile(file('font.woff2', 'font/woff2', 10)).name).toBe('font.woff2');
    expect(validateFontFile(file('font.ttf', '', 10)).name).toBe('font.ttf');
  });

  it('rejects unsupported and oversized fonts', () => {
    expect(() => validateFontFile(file('font.txt', 'text/plain', 10))).toThrow('仅支持 WOFF、WOFF2、TTF 或 OTF');
    expect(() => validateFontFile(file('font.otf', 'font/otf', 10 * 1024 * 1024 + 1))).toThrow('10MB');
  });
});
