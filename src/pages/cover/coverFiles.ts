import {
  BACKGROUND_IMAGE_MAX_BYTES, FONT_EXTENSIONS, FONT_MAX_BYTES, FONT_MIME_TYPES,
  ICON_IMAGE_MAX_BYTES, IMAGE_MIME_TYPES
} from './coverConstants';

export type ImageUploadKind = 'background' | 'icon';

function assertFile(file: File | null | undefined): asserts file is File {
  if (!file) throw new Error('请选择要上传的文件');
}

export function validateImageFile(file: File | null | undefined, kind: ImageUploadKind): File {
  assertFile(file);
  const label = kind === 'background' ? '背景图片' : '图标';
  const limit = kind === 'background' ? BACKGROUND_IMAGE_MAX_BYTES : ICON_IMAGE_MAX_BYTES;
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    throw new Error(`${label}仅支持 PNG、JPEG 或 WebP 格式`);
  }
  if (file.size > limit) throw new Error(`${label}大小不能超过 ${limit / 1024 / 1024}MB`);
  return file;
}

export function validateFontFile(file: File | null | undefined): File {
  assertFile(file);
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const validMime = (FONT_MIME_TYPES as readonly string[]).includes(file.type.toLowerCase());
  const validExtension = (FONT_EXTENSIONS as readonly string[]).includes(extension);
  if (!validMime && !validExtension) throw new Error('字体仅支持 WOFF、WOFF2、TTF 或 OTF 格式');
  if (file.size > FONT_MAX_BYTES) throw new Error('字体大小不能超过 10MB');
  return file;
}

export function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取文件失败，请重试'));
    reader.onabort = () => reject(new Error('文件读取已取消'));
    reader.readAsDataURL(file);
  });
}

export function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(reader.result)
      : reject(new Error('读取字体文件失败，请重试'));
    reader.onerror = () => reject(new Error('读取字体文件失败，请重试'));
    reader.onabort = () => reject(new Error('文件读取已取消'));
    reader.readAsArrayBuffer(file);
  });
}

export function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败，请检查文件或网络连接'));
    image.src = source;
  });
}

export async function loadImageFile(file: File, kind: ImageUploadKind): Promise<HTMLImageElement> {
  validateImageFile(file, kind);
  return loadImage(await readFileAsDataURL(file));
}

export async function loadFontFile(file: File, family = 'CustomFont'): Promise<FontFace> {
  validateFontFile(file);
  const font = new FontFace(family, await readFileAsArrayBuffer(file));
  return font.load();
}
