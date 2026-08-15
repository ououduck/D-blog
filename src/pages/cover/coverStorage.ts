const COVER_STORAGE_VERSION = 1;
const COVER_DRAFT_KEY = 'd-blog-cover-draft-v1';
const COVER_PRESETS_KEY = 'd-blog-cover-presets-v1';

export interface CoverDraft {
  version: number;
  leftText: string;
  rightText: string;
  subText: string;
  templateId: string;
  layoutMode: string;
  textAlign: string;
  bgImageX: number;
  bgImageY: number;
  bgImageScale: number;
  bgBlur: number;
  bgOpacity: number;
  bgFit: string;
  bgFlipX: boolean;
  bgFlipY: boolean;
  transparentBackground: boolean;
  jpegQuality: number;
  showIcon: boolean;
  customIcon: string | null;
  iconifyIconName: string | null;
  iconSize: number;
  iconColor: string;
  iconBorderRadius: number;
  iconBgEnabled: boolean;
  customFont: string | null;
  fontWeight: number;
  fontSize: number;
  subFontSize: number;
  textColor: string;
  spacing: number;
  subSpacing: number;
  autoTextColor: boolean;
  textStroke: { enabled: boolean; width: number; color: string };
  overlayEnabled: boolean;
  overlayBlur: number;
  overlayOpacity: number;
  overlayColor: string;
  textShadow: { x: number; y: number; blur: number; color: string; opacity: number };
  showCorners: boolean;
  cornerColor: string;
  cornerOpacity: number;
  showSeparator: boolean;
  separatorColor: string;
  separatorOpacity: number;
  activeRatioLabel: string;
  exportScale: number;
  exportFormat: 'png' | 'jpeg';
  exportFilename: string;
}

export interface StoredPreset {
  name: string;
  createdAt: number;
  state: CoverDraft;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parse<T>(key: string, fallback: T): T {
  try {
    const value = storage()?.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readDraft(): CoverDraft | null {
  const draft = parse<CoverDraft | null>(COVER_DRAFT_KEY, null);
  return draft?.version === COVER_STORAGE_VERSION ? draft : null;
}

export function writeDraft(draft: CoverDraft): boolean {
  try {
    storage()?.setItem(COVER_DRAFT_KEY, JSON.stringify({ ...draft, version: COVER_STORAGE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function readPresets(): StoredPreset[] {
  const presets = parse<StoredPreset[]>(COVER_PRESETS_KEY, []);
  return Array.isArray(presets)
    ? presets.filter((preset) => preset?.state?.version === COVER_STORAGE_VERSION && typeof preset.name === 'string')
    : [];
}

export function writePreset(name: string, state: CoverDraft): StoredPreset[] {
  const preset: StoredPreset = {
    name: name.trim() || '未命名预设',
    createdAt: Date.now(),
    state: { ...state, version: COVER_STORAGE_VERSION },
  };
  const next = [preset, ...readPresets().filter((item) => item.name !== preset.name)].slice(0, 20);
  try {
    storage()?.setItem(COVER_PRESETS_KEY, JSON.stringify(next));
  } catch {
    /* localStorage 不可用时不阻塞编辑 */
  }
  return next;
}

export function deletePreset(name: string): StoredPreset[] {
  const next = readPresets().filter((preset) => preset.name !== name);
  try {
    storage()?.setItem(COVER_PRESETS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
