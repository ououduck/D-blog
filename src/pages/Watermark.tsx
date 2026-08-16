/**
 * 水印工具页：为图片添加文字水印并导出。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Image as ImageIcon, RefreshCw, Upload, X } from 'lucide-react';
import { Seo } from '../components/Seo';
import { downloadBlob } from '@/utils/download';
import {
  DEFAULT_WATERMARK_OPTIONS,
  clampWatermarkFontSize,
  clampWatermarkOpacity,
  getWatermarkFilename,
  renderWatermark,
  type WatermarkPosition,
} from './watermark/watermarkRenderer';

type Feedback = { kind: 'success' | 'error'; message: string } | null;

type ImageState = {
  image: HTMLImageElement;
  name: string;
};

const positions: Array<{ value: WatermarkPosition; label: string }> = [
  { value: 'top-left', label: '左上' },
  { value: 'top-center', label: '顶部居中' },
  { value: 'top-right', label: '右上' },
  { value: 'center-left', label: '左侧居中' },
  { value: 'center', label: '正中央' },
  { value: 'center-right', label: '右侧居中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-center', label: '底部居中' },
  { value: 'bottom-right', label: '右下' },
];

const inputClass = 'editorial-input';
const cardClass = 'editorial-surface p-4 min-[360px]:p-5 md:p-6';
const MAX_IMAGE_FILE_BYTES = 25 * 1024 * 1024;
// 加载像素上限：超过即拒绝加载。与导出能力一致，保证任何已加载图片都能直接导出
// （此前加载上限大于导出上限，会出现能预览但导不出的死状态）。
const MAX_IMAGE_PIXELS = 24_000_000;

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let settled = false;
    const cleanup = () => URL.revokeObjectURL(url);
    // 超时兜底：个别损坏/无法解码的格式可能 onload/onerror 都不触发，
    // Promise 会永久 pending，handleFile 卡死、UI 无任何反馈。
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('图片加载超时，请更换图片后重试。'));
    }, 10000);
    image.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      cleanup();
      reject(new Error('图片加载失败，请选择有效的图片文件。'));
    };
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, format: 'png' | 'jpeg', quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片导出失败，请重试。'))),
      `image/${format}`,
      format === 'jpeg' ? quality : undefined,
    );
  });

export const Watermark: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageLoadGenerationRef = useRef(0);
  const [imageState, setImageState] = useState<ImageState | null>(null);
  const [text, setText] = useState(DEFAULT_WATERMARK_OPTIONS.text);
  const [fontSize, setFontSize] = useState(DEFAULT_WATERMARK_OPTIONS.fontSize);
  const [position, setPosition] = useState<WatermarkPosition>(DEFAULT_WATERMARK_OPTIONS.position);
  const [opacity, setOpacity] = useState(DEFAULT_WATERMARK_OPTIONS.opacity);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [quality, setQuality] = useState(92);
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const drawPreview = useCallback(() => {
    if (!imageState || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const maxWidth = 1200;
    const scale = Math.min(1, maxWidth / imageState.image.naturalWidth);
    canvas.width = Math.max(1, Math.round(imageState.image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(imageState.image.naturalHeight * scale));
    renderWatermark(canvas, imageState.image, {
      text,
      fontSize: fontSize * scale,
      opacity,
      position,
      padding: 32 * scale,
    });
  }, [fontSize, imageState, opacity, position, text]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const handleFile = async (file?: File) => {
    const generation = ++imageLoadGenerationRef.current;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      // 更换新图被拒时清空旧图预览：避免"错误提示配旧图"的 UI 自相矛盾。
      setImageState(null);
      setFeedback({ kind: 'error', message: '请选择 PNG、JPEG、WebP 等图片文件。' });
      return;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      setImageState(null);
      setFeedback({ kind: 'error', message: '图片文件不能超过 25MB，请压缩后重试。' });
      return;
    }
    try {
      const image = await loadImage(file);
      if (generation !== imageLoadGenerationRef.current) return;
      const totalPixels = image.naturalWidth * image.naturalHeight;
      if (!image.naturalWidth || !image.naturalHeight || totalPixels > MAX_IMAGE_PIXELS) {
        setImageState(null);
        setFeedback({ kind: 'error', message: '图片总像素不能超过 2400 万像素，请缩小尺寸后重试。' });
        return;
      }
      setImageState({ image, name: file.name });
      setFeedback(null);
    } catch (error) {
      if (generation !== imageLoadGenerationRef.current) return;
      setImageState(null);
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '图片加载失败。' });
    }
  };

  const reset = () => {
    setText(DEFAULT_WATERMARK_OPTIONS.text);
    setFontSize(DEFAULT_WATERMARK_OPTIONS.fontSize);
    setPosition(DEFAULT_WATERMARK_OPTIONS.position);
    setOpacity(DEFAULT_WATERMARK_OPTIONS.opacity);
    setFormat('png');
    setQuality(92);
    setFeedback(null);
  };

  const exportImage = async () => {
    if (!imageState) return;
    // 导出期间移除图片会让「成功提示」配「空界面」自相矛盾：记录导出起点代际，
    // 结束时若代际已变（图片被移除/更换）则跳过 success 提示。
    const exportGeneration = imageLoadGenerationRef.current;
    setIsExporting(true);
    setFeedback(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imageState.image.naturalWidth;
      canvas.height = imageState.image.naturalHeight;
      if (format === 'jpeg') {
        // JPEG 不支持透明：canvas 透明区域按黑合成，透明 PNG 导出 JPEG 会得到
        // 大黑底，与预览观感严重不一致；先铺白底。
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      renderWatermark(canvas, imageState.image, { text, fontSize, opacity, position, padding: 32 });
      const blob = await canvasToBlob(canvas, format, quality / 100);
      downloadBlob(blob, getWatermarkFilename(imageState.name, format));
      if (exportGeneration === imageLoadGenerationRef.current) {
        setFeedback({ kind: 'success', message: '水印图片已下载。' });
      }
    } catch (error) {
      if (exportGeneration === imageLoadGenerationRef.current) {
        setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '导出失败，请重试。' });
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl pb-12 pt-6 md:pb-20 md:pt-10">
      <Seo
        title="水印工具"
        description="在浏览器中免费为图片添加文字水印，支持自定义文字样式、实时预览与本地导出，无需上传文件，保护图片版权。"
      />
      <header className="mb-8 border-b border-zinc-200 pb-8 dark:border-zinc-800 md:mb-10 md:pb-10">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">
          Image Watermark
        </p>
        <h1 className="mb-4 font-serif text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">
          图片水印
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
          选择一张图片，添加轻量的文字标识。所有处理都在本地完成，不会上传你的图片。
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className={cardClass}>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} />
                <h2 className="font-bold text-ink dark:text-white">图片</h2>
              </div>
              {imageState && (
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-icon text-zinc-400 hover:bg-zinc-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-white"
                  onClick={() => {
                    imageLoadGenerationRef.current += 1;
                    setImageState(null);
                    setFeedback(null);
                  }}
                  // 导出进行中禁用移除：大图 toBlob 需数百毫秒，期间移除图片会
                  // 造成「成功提示配空界面」的状态错位（下方 exportImage 另有代际防护）。
                  disabled={isExporting}
                  aria-label="移除图片"
                  title="移除图片"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="editorial-button min-h-11 w-full"
            >
              <Upload size={16} />
              {imageState ? '更换图片' : '选择图片'}
            </button>
            <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              支持常见图片格式，最大 25MB、2400 万像素。
            </p>
            {imageState && (
              <p
                className="mt-2 truncate text-xs text-zinc-500 dark:text-zinc-400"
                title={`${imageState.name} · ${imageState.image.naturalWidth} × ${imageState.image.naturalHeight}`}
              >
                {imageState.name} · {imageState.image.naturalWidth} × {imageState.image.naturalHeight}
              </p>
            )}
          </section>

          <section className={cardClass}>
            <h2 className="mb-5 font-bold text-ink dark:text-white">水印设置</h2>
            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">水印文字</span>
              <input
                className={inputClass}
                value={text}
                maxLength={120}
                onChange={(event) => setText(event.target.value)}
                placeholder="输入水印文字"
              />
            </label>
            <label className="mb-4 block">
              <div className="mb-1 flex justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                <span>字体大小</span>
                <output>{fontSize}px</output>
              </div>
              <div className="flex min-h-11 items-center">
                <input
                  className="h-11 w-full cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                  type="range"
                  min="8"
                  max="240"
                  value={fontSize}
                  onChange={(event) => setFontSize(clampWatermarkFontSize(Number(event.target.value)))}
                />
              </div>
            </label>
            <label className="mb-4 block">
              <div className="mb-1 flex justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                <span>不透明度</span>
                <output>{opacity}%</output>
              </div>
              <div className="flex min-h-11 items-center">
                <input
                  className="h-11 w-full cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                  type="range"
                  min="0"
                  max="100"
                  value={opacity}
                  onChange={(event) => setOpacity(clampWatermarkOpacity(Number(event.target.value)))}
                />
              </div>
            </label>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">位置</legend>
              <div role="group" aria-label="水印位置" className="grid grid-cols-3 gap-1.5">
                {positions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPosition(item.value)}
                    aria-pressed={position === item.value}
                    className={`min-h-11 min-w-0 rounded-control border px-1 text-[11px] leading-tight transition-colors min-[360px]:px-2 min-[360px]:text-xs ${position === item.value ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950' : 'border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          <section className={cardClass}>
            <h2 className="mb-5 font-bold text-ink dark:text-white">导出</h2>
            <div className="mb-4 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <label className="min-w-0 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                格式
                <select
                  className={`${inputClass} mt-2 min-w-0`}
                  value={format}
                  onChange={(event) => setFormat(event.target.value as 'png' | 'jpeg')}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                </select>
              </label>
              <label className="min-w-0 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                质量
                <select
                  className={`${inputClass} mt-2 min-w-0`}
                  value={quality}
                  disabled={format === 'png'}
                  onChange={(event) => setQuality(Number(event.target.value))}
                >
                  <option value="100">100%</option>
                  <option value="92">92%</option>
                  <option value="80">80%</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              <button type="button" className="editorial-button min-h-11 min-w-0" onClick={reset}>
                <RefreshCw size={15} />
                重置
              </button>
              <button
                type="button"
                className="editorial-button-primary min-h-11 min-w-0"
                disabled={!imageState || isExporting}
                onClick={() => {
                  void exportImage();
                }}
              >
                <Download size={15} />
                {isExporting ? '处理中…' : '下载图片'}
              </button>
            </div>
            {feedback && (
              <p
                className={`mt-3 break-words text-xs ${feedback.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                role="status"
              >
                {feedback.message}
              </p>
            )}
          </section>
        </aside>

        <section className={`${cardClass} min-h-[26rem] md:min-h-[30rem]`} aria-label="水印预览">
          <div className="mb-5 flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                Preview
              </p>
              <h2 className="font-serif text-xl font-bold text-ink dark:text-white">实时预览</h2>
            </div>
            {imageState && <span className="text-xs text-zinc-500 dark:text-zinc-400">{format.toUpperCase()}</span>}
          </div>
          <div className="flex min-h-[20rem] min-w-0 items-center justify-center overflow-hidden rounded-control border border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-800 dark:bg-zinc-950/60 min-[360px]:min-h-[24rem] min-[360px]:p-4 md:min-h-[34rem]">
            {imageState ? (
              <canvas
                ref={canvasRef}
                className="block h-auto max-h-[32rem] max-w-full object-contain shadow-sm"
                aria-label="添加水印后的图片预览"
              />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-3 px-2 text-zinc-500 transition-colors hover:text-ink dark:text-zinc-400 dark:hover:text-white"
              >
                <ImageIcon size={40} strokeWidth={1.2} />
                <span className="text-center text-sm">选择图片开始预览</span>
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
