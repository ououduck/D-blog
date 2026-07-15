import type { CoverTemplate } from '../../config/coverTemplates';

export type { CoverTemplate } from '../../config/coverTemplates';

export type LayoutMode = 'icon-split' | 'stacked' | 'icon-only' | 'text-only';
export type TextAlign = 'left' | 'center' | 'right';
export type ExportFormat = 'png' | 'jpeg';

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CoverRatio {
  label: string;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ShadowConfig {
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
}

export interface StrokeConfig {
  enabled: boolean;
  width: number;
  color: string;
}

export interface OverlayConfig {
  enabled: boolean;
  blur: number;
  opacity: number;
  color: string;
}

export interface BackgroundImageConfig {
  image: CanvasImageSource;
  x: number;
  y: number;
  scale: number;
  blur: number;
  opacity: number;
}

export interface IconConfig {
  show: boolean;
  source: string | CanvasImageSource | null;
  size: number;
  borderRadius: number;
  backgroundEnabled: boolean;
}

export interface DecorationConfig {
  showCorners: boolean;
  cornerColor: string;
  cornerOpacity: number;
  showSeparator: boolean;
  separatorColor: string;
  separatorOpacity: number;
}

export interface CoverRenderOptions {
  size: CanvasSize;
  template: CoverTemplate;
  layout: LayoutMode;
  textAlign: TextAlign;
  leftText: string;
  rightText: string;
  subText: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  subFontSize: number;
  textColor: string;
  autoTextColor: boolean;
  spacing: number;
  subSpacing: number;
  textShadow: ShadowConfig;
  textStroke: StrokeConfig;
  backgroundImage?: BackgroundImageConfig | null;
  overlay: OverlayConfig;
  icon: IconConfig;
  decorations: DecorationConfig;
  maxTextLines?: number;
  minFontSize?: number;
}

export interface FittedText {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  truncated: boolean;
}
