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

export interface LoadResourceOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

function readBlob<T extends string | ArrayBuffer>(
  read: (reader: FileReader) => void,
  errorMessage: string,
  options: LoadResourceOptions = {}
): Promise<T> {
  const { timeoutMs = 8000, signal } = options;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      finish(new Error(`${errorMessage}超时，请重试`));
      if (reader.readyState === FileReader.LOADING) reader.abort();
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(reader.result as T);
    };
    const handleAbort = () => {
      if (reader.readyState === FileReader.LOADING) reader.abort();
      finish(new Error('文件读取已取消'));
    };
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });
    reader.onload = () => finish();
    reader.onerror = () => finish(new Error(`${errorMessage}失败，请重试`));
    reader.onabort = () => finish(new Error('文件读取已取消'));
    read(reader);
  });
}

export function readFileAsDataURL(file: Blob, options?: LoadResourceOptions): Promise<string> {
  return readBlob<string>((reader) => reader.readAsDataURL(file), '读取文件', options);
}

export function readFileAsArrayBuffer(file: Blob, options?: LoadResourceOptions): Promise<ArrayBuffer> {
  return readBlob<ArrayBuffer>((reader) => reader.readAsArrayBuffer(file), '读取字体文件', options)
    .then((result) => result instanceof ArrayBuffer ? result : Promise.reject(new Error('读取字体文件失败，请重试')));
}

export function loadImage(source: string, options: LoadResourceOptions = {}): Promise<HTMLImageElement> {
  const { timeoutMs = 8000, signal } = options;
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const timeoutId = window.setTimeout(() => finish(new Error('图片加载超时，请检查网络连接')), timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(image);
    };
    const handleAbort = () => {
      image.src = '';
      finish(new Error('图片加载已取消'));
    };
    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });
    image.crossOrigin = 'anonymous';
    image.onload = () => finish();
    image.onerror = () => finish(new Error('图片加载失败，请检查文件或网络连接'));
    image.src = source;
  });
}

export async function loadImageFile(file: File, kind: ImageUploadKind): Promise<HTMLImageElement> {
  validateImageFile(file, kind);
  return loadImage(await readFileAsDataURL(file), { timeoutMs: 8000 });
}

export async function loadFontFile(
  file: File,
  family = 'CustomFont',
  options: LoadResourceOptions = {}
): Promise<FontFace> {
  validateFontFile(file);
  const font = new FontFace(family, await readFileAsArrayBuffer(file, options));
  const { timeoutMs = 8000, signal } = options;
  if (signal?.aborted) throw new Error('字体加载已取消');
  let timeoutId: number | undefined;
  let abortHandler: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('字体加载超时，请重试')), timeoutMs);
  });
  const abort = new Promise<never>((_, reject) => {
    abortHandler = () => reject(new Error('字体加载已取消'));
    signal?.addEventListener('abort', abortHandler, { once: true });
  });
  try {
    return await Promise.race([font.load(), timeout, abort]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    if (abortHandler) signal?.removeEventListener('abort', abortHandler);
  }
}
