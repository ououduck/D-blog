import type { CoverRatio, ShadowConfig } from './coverTypes';

export const BASE_CANVAS_WIDTH = 1200;
export const CANVAS_SAFE_MARGIN = 80;
export const COVER_RATIOS: readonly CoverRatio[] = [
  { label: '16:9', w: 16, h: 9 },
  { label: '1:1', w: 1, h: 1 },
  { label: '4:3', w: 4, h: 3 },
  { label: '21:9', w: 21, h: 9 }
];
export const MIN_EXPORT_SCALE = 0.5;
export const MAX_EXPORT_SCALE = 4;
export const MIN_BACKGROUND_SCALE = 0.1;
export const MAX_BACKGROUND_SCALE = 10;
export const DEFAULT_TEXT_SHADOW: Readonly<ShadowConfig> = {
  x: 2, y: 2, blur: 8, color: '#000000', opacity: 0.3
};
export const BACKGROUND_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const ICON_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const FONT_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const FONT_MIME_TYPES = [
  'font/woff', 'font/woff2', 'font/ttf', 'font/otf',
  'application/font-woff', 'application/x-font-ttf', 'application/x-font-opentype'
] as const;
export const FONT_EXTENSIONS = ['woff', 'woff2', 'ttf', 'otf'] as const;
