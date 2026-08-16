/**
 * 封面导出工具：canvas 转 Blob（含跨域污染的降级提示）与画布合成导出，
 * 供批量导出与单张保存共用。
 */
import type { ExportFormat } from './coverTypes';

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }
          // toBlob 对跨域污染的 canvas 会回调 null（不抛同步异常），无法与真实
          // 编码失败区分。用 toDataURL 探测：tainted canvas 会抛 SecurityError，
          // 借此给出针对性错误文案（原实现 catch 分支实际不可达，跨域场景
          // 用户只会看到笼统的「图片编码失败」）。
          try {
            canvas.toDataURL(type, quality);
            reject(new Error('图片编码失败，请重试'));
          } catch {
            reject(new Error('素材跨域限制导致无法导出，请更换图标或图片'));
          }
        },
        type,
        quality,
      );
    } catch {
      // 同步抛错（极罕见，如参数非法）：按跨域限制兜底文案处理。
      reject(new Error('素材跨域限制导致无法导出，请更换图标或图片'));
    }
  });
}

export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  format: ExportFormat,
  quality?: number,
): Promise<void> {
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await canvasToBlob(canvas, mimeType, format === 'jpeg' ? quality : undefined);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}

export async function copyCanvas(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality?: number,
): Promise<'native' | 'png-fallback'> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器不支持复制图片，请直接下载');
  }
  const preferredMime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await canvasToBlob(canvas, preferredMime, format === 'jpeg' ? quality : undefined);
  try {
    await navigator.clipboard.write([new ClipboardItem({ [preferredMime]: blob })]);
    return 'native';
  } catch {
    if (preferredMime === 'image/png') throw new Error('复制失败，请直接下载');
    const png = await canvasToBlob(canvas, 'image/png');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return 'png-fallback';
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 100);
  }
}
