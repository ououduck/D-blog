import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Download, RefreshCw, Type, Image as ImageIcon, Palette,
  Sparkles, Upload, X, Search, Copy, Check, Layout, Shuffle,
  ChevronDown, ChevronUp, Frame, SplitSquareHorizontal, AlignLeft, AlignCenter, AlignRight, Wand2, ArrowLeftRight, RotateCcw
} from 'lucide-react';
import { Seo } from '../components/Seo';
import { SearchField } from '../components/SearchField';
import { hasOpenOverlay, useModalOverlay } from '../hooks/useModalOverlay';
import { coverTemplates as templates, defaultTemplate, type CoverTemplate } from '../config/coverTemplates';
import {
  COVER_RATIOS, DEFAULT_TEXT_SHADOW, MAX_BACKGROUND_SCALE, MAX_EXPORT_SCALE,
  MIN_BACKGROUND_SCALE, MIN_EXPORT_SCALE
} from './cover/coverConstants';
import { clamp, getCanvasSize, getExportFilename } from './cover/coverLayout';
import { loadFontFile, loadImageFile } from './cover/coverFiles';
import { canvasToBlob, copyCanvas, downloadBlob, downloadCanvas } from './cover/coverExport';
import { BatchCoverDialog } from './cover/BatchCoverDialog';
import { createBatchZip, type BatchCoverItem } from './cover/coverBatch';
import { preloadImage } from './cover/coverImageCache';
import { renderCover } from './cover/coverRenderer';
import { assetUrl } from '@/utils/siteUrl';
import type { BackgroundFit, CoverRenderOptions, LayoutMode, ShadowConfig, TextAlign } from './cover/coverTypes';
import { deletePreset, readDraft, readPresets, type CoverDraft, type StoredPreset, writeDraft, writePreset } from './cover/coverStorage';

const DEFAULT_ICON_SOURCE = assetUrl('/logo.png');

type Feedback = {
  kind: 'success' | 'error' | 'info';
  message: string;
} | null;

type IconifySearchResponse = {
  icons?: string[];
};

type SectionHeaderProps = {
  icon: React.ReactNode;
  title: string;
  sectionKey: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  action?: React.ReactNode;
};

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, sectionKey, collapsed, onToggle, action }) => (
  <div className="mb-4 flex items-center justify-between">
    <div className="flex min-w-0 items-center gap-2">
      {icon}
      <h2 className="font-bold text-ink dark:text-white">{title}</h2>
      <button type="button" onClick={() => onToggle(sectionKey)} aria-expanded={!collapsed} aria-label={`${collapsed ? '展开' : '收起'}${title}`} className="inline-flex rounded-icon p-1 text-zinc-400 transition-opacity hover:bg-zinc-100 hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-white">
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
    {action}
  </div>
);

export const CoverGenerator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const iconSearchInputRef = useRef<HTMLInputElement>(null);
  const iconifyDialogRef = useRef<HTMLDivElement>(null);
  const bgImageLoadGenerationRef = useRef(0);
  const iconLoadGenerationRef = useRef(0);
  const renderIdRef = useRef(0);
  const shouldReduceMotion = useReducedMotion();

  // 基础文本状态
  const [leftText, setLeftText] = useState('D-blog');
  const [rightText, setRightText] = useState('跑路的duck');
  const [subText, setSubText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CoverTemplate>(defaultTemplate);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [renderWarnings, setRenderWarnings] = useState<string[]>([]);
  const customFontFaceRef = useRef<FontFace | null>(null);

  // 排版布局
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('icon-split');
  const [textAlign, setTextAlign] = useState<TextAlign>('center');

  // 背景图片状态
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgImageX, setBgImageX] = useState(0);
  const [bgImageY, setBgImageY] = useState(0);
  const [bgImageScale, setBgImageScale] = useState(1);
  const [bgBlur, setBgBlur] = useState(0);
  const [bgOpacity, setBgOpacity] = useState(100);
  const [bgFit, setBgFit] = useState<BackgroundFit>('cover');
  const [bgFlipX, setBgFlipX] = useState(false);
  const [bgFlipY, setBgFlipY] = useState(false);
  const [bgFileName, setBgFileName] = useState<string | null>(null);
  const [bgDragActive, setBgDragActive] = useState(false);
  const [transparentBackground, setTransparentBackground] = useState(false);
  const [jpegQuality, setJpegQuality] = useState(92);
  const [isDragging, setIsDragging] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const dragStateRef = useRef({ pointerId: -1, startX: 0, startY: 0, imageX: 0, imageY: 0 });

  // 图标状态
  const [showIcon, setShowIcon] = useState(true);
  const [customIcon, setCustomIcon] = useState<string | null>(DEFAULT_ICON_SOURCE);
  const [iconifyIconName, setIconifyIconName] = useState<string | null>(null);
  const [iconSize, setIconSize] = useState(80);
  const [iconColor, setIconColor] = useState('#ffffff');
  const [iconBorderRadius, setIconBorderRadius] = useState(12);
  const [iconBgEnabled, setIconBgEnabled] = useState(true);

  // Iconify 搜索状态
  const [iconifySearch, setIconifySearch] = useState('');
  const [iconifyResults, setIconifyResults] = useState<string[]>([]);
  const [failedIconifyResults, setFailedIconifyResults] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [showIconifyModal, setShowIconifyModal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const iconifyAbortRef = useRef<AbortController | null>(null);
  const iconifySearchIdRef = useRef(0);

  // 字体状态
  const [customFont, setCustomFont] = useState<string | null>(null);
  const [fontWeight, setFontWeight] = useState(700);
  const [fontSize, setFontSize] = useState(72);
  const [subFontSize, setSubFontSize] = useState(28);
  const [textColor, setTextColor] = useState('#ffffff');
  const [spacing, setSpacing] = useState(32);
  const [subSpacing, setSubSpacing] = useState(16);
  const [autoTextColor, setAutoTextColor] = useState(true);

  // 文字描边状态
  const [textStroke, setTextStroke] = useState({
    enabled: false,
    width: 2,
    color: '#000000'
  });

  // 背景遮罩状态
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [overlayBlur, setOverlayBlur] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [overlayColor, setOverlayColor] = useState('#000000');

  // 阴影状态
  const [textShadow, setTextShadow] = useState<ShadowConfig>(DEFAULT_TEXT_SHADOW);

  // 装饰元素
  const [showCorners, setShowCorners] = useState(false);
  const [cornerColor, setCornerColor] = useState('#ffffff');
  const [cornerOpacity, setCornerOpacity] = useState(30);
  const [showSeparator, setShowSeparator] = useState(false);
  const [separatorColor, setSeparatorColor] = useState('#ffffff');
  const [separatorOpacity, setSeparatorOpacity] = useState(30);

  // 导出设置
  const [activeRatioLabel, setActiveRatioLabel] = useState(COVER_RATIOS[0].label);
  const [exportScale, setExportScale] = useState(1);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [exportFilename, setExportFilename] = useState('cover');
  const [activeTab, setActiveTab] = useState<'content' | 'style' | 'layout' | 'export'>('content');
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ completed: number; total: number } | null>(null);
  const batchAbortRef = useRef<AbortController | null>(null);

  const closeIconifyModal = useCallback(() => setShowIconifyModal(false), []);
  useModalOverlay({
    isOpen: showIconifyModal,
    onClose: closeIconifyModal,
    initialFocusRef: iconSearchInputRef,
    containerRef: iconifyDialogRef
  });

  // 折叠面板
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isCollapsed = (key: string) => collapsedSections.has(key);

  const handleTabKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = ['content', 'style', 'layout', 'export'] as const;
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`cover-tab-${nextTab}`)?.focus());
  }, [activeTab]);

  const resetBackgroundImageControls = useCallback(() => {
    setBgImageScale(1);
    setBgImageX(0);
    setBgImageY(0);
    setBgBlur(0);
    setBgOpacity(100);
    setBgFit('cover');
    setBgFlipX(false);
    setBgFlipY(false);
  }, []);

  const swapMainTexts = useCallback(() => {
    setLeftText(rightText);
    setRightText(leftText);
  }, [leftText, rightText]);

  const resetStyleSettings = useCallback(() => {
    setFontWeight(700);
    setFontSize(72);
    setSubFontSize(28);
    setTextColor('#ffffff');
    setSpacing(32);
    setSubSpacing(16);
    setAutoTextColor(true);
    setTextStroke({ enabled: false, width: 2, color: '#000000' });
    setOverlayEnabled(false);
    setOverlayBlur(0);
    setOverlayOpacity(50);
    setOverlayColor('#000000');
    setTextShadow(DEFAULT_TEXT_SHADOW);
    setShowCorners(false);
    setCornerColor('#ffffff');
    setCornerOpacity(30);
    setShowSeparator(false);
    setSeparatorColor('#ffffff');
    setSeparatorOpacity(30);
    setIconSize(80);
    setIconColor('#ffffff');
    setIconBorderRadius(12);
    setIconBgEnabled(true);
  }, []);

  const resetAllSettings = useCallback(() => {
    setLeftText('D-blog');
    setRightText('跑路的duck');
    setSubText('');
    setSelectedTemplate(defaultTemplate);
    setLayoutMode('icon-split');
    setTextAlign('center');
    bgImageLoadGenerationRef.current += 1;
    setBgImage(null);
    setBgFileName(null);
    resetBackgroundImageControls();
    setTransparentBackground(false);
    setJpegQuality(92);
    iconLoadGenerationRef.current += 1;
    setShowIcon(true);
    setCustomIcon(DEFAULT_ICON_SOURCE);
    setIconifyIconName(null);
    if (iconifyDebounceRef.current) window.clearTimeout(iconifyDebounceRef.current);
    iconifyAbortRef.current?.abort();
    iconifySearchIdRef.current += 1;
    setIconifySearch('');
    setIconifyResults([]);
    setFailedIconifyResults(new Set());
    setSearchError(null);
    setIsSearching(false);
    setCustomFont(null);
    resetStyleSettings();
    setActiveRatioLabel(COVER_RATIOS[0].label);
    setExportScale(1);
    setExportFormat('png');
    setExportFilename('cover');
    setActiveTab('content');
    setCollapsedSections(new Set());
    setCopied(false);
    setFeedback(null);
    closeIconifyModal();
  }, [closeIconifyModal, resetBackgroundImageControls, resetStyleSettings]);

  const activeRatio = COVER_RATIOS.find(ratio => ratio.label === activeRatioLabel) || COVER_RATIOS[0];
  const canvasSize = useMemo(() => getCanvasSize(activeRatio), [activeRatio]);

  const quickStats = useMemo(() => {
    const textCount = [leftText, rightText, subText].filter(Boolean).join('').length;
    return [
      { label: '模板', value: selectedTemplate.name },
      { label: '布局', value: layoutMode === 'icon-split' ? '分列' : layoutMode === 'stacked' ? '堆叠' : layoutMode === 'text-only' ? '纯文字' : '图标' },
      { label: '元素', value: `${showIcon && customIcon ? '图标' : '文字'} · ${textCount} 字` },
      { label: '导出', value: `${activeRatio.label} · ${exportFormat.toUpperCase()}` },
    ];
  }, [activeRatio.label, customIcon, exportFormat, layoutMode, leftText, rightText, selectedTemplate.name, showIcon, subText]);

  const serializableDraft = useMemo<CoverDraft>(() => ({
    version: 1, leftText, rightText, subText, templateId: selectedTemplate.id, layoutMode, textAlign,
    bgImageX, bgImageY, bgImageScale, bgBlur, bgOpacity, bgFit, bgFlipX, bgFlipY, transparentBackground, jpegQuality,
    showIcon, customIcon: customIcon?.startsWith('data:') ? null : customIcon, iconifyIconName, iconSize, iconColor,
    iconBorderRadius, iconBgEnabled, customFont, fontWeight, fontSize, subFontSize, textColor, spacing, subSpacing, autoTextColor,
    textStroke, overlayEnabled, overlayBlur, overlayOpacity, overlayColor, textShadow, showCorners, cornerColor, cornerOpacity,
    showSeparator, separatorColor, separatorOpacity, activeRatioLabel, exportScale, exportFormat, exportFilename,
  }), [activeRatioLabel, autoTextColor, bgBlur, bgFit, bgFlipX, bgFlipY, bgImageScale, bgImageX, bgImageY, bgOpacity,
    customFont, customIcon, exportFilename, exportFormat, exportScale, fontSize, fontWeight, iconBgEnabled, iconBorderRadius,
    iconColor, iconifyIconName, iconSize, jpegQuality, layoutMode, leftText, overlayBlur, overlayColor, overlayEnabled,
    rightText, selectedTemplate.id, separatorColor, separatorOpacity, showCorners, showIcon, showSeparator, spacing,
    subFontSize, subSpacing, subText, textAlign, textColor, textShadow, textStroke, transparentBackground]);

  const historyRef = useRef<{ past: CoverDraft[]; future: CoverDraft[] }>({ past: [], future: [] });
  const lastDraftRef = useRef<string | null>(null);
  const restoringDraftRef = useRef(false);
  const historyReadyRef = useRef(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [presets, setPresets] = useState<StoredPreset[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const canUndo = historyVersion >= 0 && historyRef.current.past.length > 0;
  const canRedo = historyVersion >= 0 && historyRef.current.future.length > 0;
  const [presetName, setPresetName] = useState('');

  const applyDraft = useCallback((draft: CoverDraft) => {
    restoringDraftRef.current = true;
    setLeftText(draft.leftText); setRightText(draft.rightText); setSubText(draft.subText);
    setSelectedTemplate(templates.find((template) => template.id === draft.templateId) || defaultTemplate);
    setLayoutMode(draft.layoutMode as LayoutMode); setTextAlign(draft.textAlign as TextAlign);
    setBgImageX(draft.bgImageX); setBgImageY(draft.bgImageY); setBgImageScale(draft.bgImageScale); setBgBlur(draft.bgBlur); setBgOpacity(draft.bgOpacity);
    setBgFit(draft.bgFit as BackgroundFit); setBgFlipX(draft.bgFlipX); setBgFlipY(draft.bgFlipY); setTransparentBackground(draft.transparentBackground); setJpegQuality(draft.jpegQuality);
    setShowIcon(draft.showIcon); setCustomIcon(draft.customIcon || DEFAULT_ICON_SOURCE); setIconifyIconName(draft.iconifyIconName); setIconSize(draft.iconSize); setIconColor(draft.iconColor); setIconBorderRadius(draft.iconBorderRadius); setIconBgEnabled(draft.iconBgEnabled);
    setCustomFont(draft.customFont); setFontWeight(draft.fontWeight); setFontSize(draft.fontSize); setSubFontSize(draft.subFontSize); setTextColor(draft.textColor); setSpacing(draft.spacing); setSubSpacing(draft.subSpacing); setAutoTextColor(draft.autoTextColor);
    setTextStroke(draft.textStroke); setOverlayEnabled(draft.overlayEnabled); setOverlayBlur(draft.overlayBlur); setOverlayOpacity(draft.overlayOpacity); setOverlayColor(draft.overlayColor); setTextShadow(draft.textShadow);
    setShowCorners(draft.showCorners); setCornerColor(draft.cornerColor); setCornerOpacity(draft.cornerOpacity); setShowSeparator(draft.showSeparator); setSeparatorColor(draft.separatorColor); setSeparatorOpacity(draft.separatorOpacity);
    setActiveRatioLabel(draft.activeRatioLabel); setExportScale(draft.exportScale); setExportFormat(draft.exportFormat); setExportFilename(draft.exportFilename);
  }, []);

  useEffect(() => {
    const draft = readDraft();
    setPresets(readPresets());
    if (draft) { applyDraft(draft); setDraftRestored(true); }
    lastDraftRef.current = JSON.stringify(draft || serializableDraft);
    historyReadyRef.current = true;
  }, [applyDraft]);

  useEffect(() => {
    const serialized = JSON.stringify(serializableDraft);
    if (!historyReadyRef.current) return;
    if (restoringDraftRef.current) { restoringDraftRef.current = false; lastDraftRef.current = serialized; writeDraft(serializableDraft); return; }
    if (lastDraftRef.current && lastDraftRef.current !== serialized) {
      historyRef.current.past = [...historyRef.current.past, JSON.parse(lastDraftRef.current) as CoverDraft].slice(-50);
      historyRef.current.future = [];
      setHistoryVersion((value) => value + 1);
    }
    lastDraftRef.current = serialized;
    writeDraft(serializableDraft);
  }, [serializableDraft]);

  const undo = useCallback(() => {
    const previous = historyRef.current.past.pop();
    if (!previous) return;
    historyRef.current.future.unshift(serializableDraft);
    setHistoryVersion((value) => value + 1);
    applyDraft(previous);
  }, [applyDraft, serializableDraft]);

  const redo = useCallback(() => {
    const next = historyRef.current.future.shift();
    if (!next) return;
    historyRef.current.past.push(serializableDraft);
    setHistoryVersion((value) => value + 1);
    applyDraft(next);
  }, [applyDraft, serializableDraft]);

  const savePreset = useCallback(() => {
    const name = presetName.trim() || `预设 ${presets.length + 1}`;
    setPresets(writePreset(name, serializableDraft));
    setPresetName('');
    setFeedback({ kind: 'success', message: `已保存预设“${name}”（图片和字体需重新上传）` });
  }, [presetName, presets.length, serializableDraft]);

  const loadPreset = useCallback((preset: StoredPreset) => {
    applyDraft(preset.state);
    setFeedback({ kind: 'success', message: `已加载预设“${preset.name}”；图片和字体需重新上传` });
  }, [applyDraft]);

  const removePreset = useCallback((name: string) => {
    setPresets(deletePreset(name));
    setFeedback({ kind: 'success', message: `已删除预设“${name}”` });
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (hasOpenOverlay() || (!(event.ctrlKey || event.metaKey)) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '')) return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [redo, undo]);

  const handleBgImageFile = useCallback(async (file: File) => {
    const generation = ++bgImageLoadGenerationRef.current;
    try {
      const image = await loadImageFile(file, 'background');
      if (generation !== bgImageLoadGenerationRef.current) return;
      setBgImage(image);
      setBgFileName(file.name);
      setBgImageScale(1);
      setBgImageX(0);
      setBgImageY(0);
      setBgBlur(0);
      setBgOpacity(100);
      setBgFit('cover');
      setBgFlipX(false);
      setBgFlipY(false);
      setFeedback({ kind: 'success', message: '背景图片已加载' });
    } catch (error) {
      if (generation !== bgImageLoadGenerationRef.current) return;
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '背景图片加载失败' });
    }
  }, []);

  const handleBgImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (file) await handleBgImageFile(file);
    input.value = '';
  }, [handleBgImageFile]);

  const handleBgDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setBgDragActive(true);
  }, []);

  const handleBgDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBgDragActive(false);
  }, []);

  const handleBgDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBgDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleBgImageFile(file);
  }, [handleBgImageFile]);

  const handleIconUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const generation = ++iconLoadGenerationRef.current;
    try {
      const file = input.files?.[0];
      if (!file) return;
      const image = await loadImageFile(file, 'icon');
      if (generation !== iconLoadGenerationRef.current) return;
      setCustomIcon(image.src);
      setIconifyIconName(null);
      setFeedback({ kind: 'success', message: '图标已加载' });
    } catch (error) {
      if (generation !== iconLoadGenerationRef.current) return;
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '图标加载失败' });
    } finally {
      input.value = '';
    }
  }, []);

  const iconifyDebounceRef = useRef<number | null>(null);
  const resetIconifySearch = useCallback((clearQuery = true) => {
    if (iconifyDebounceRef.current) {
      window.clearTimeout(iconifyDebounceRef.current);
      iconifyDebounceRef.current = null;
    }
    iconifyAbortRef.current?.abort();
    iconifyAbortRef.current = null;
    iconifySearchIdRef.current += 1;
    setIconifyResults([]);
    setFailedIconifyResults(new Set());
    setSearchError(null);
    setIsSearching(false);
    if (clearQuery) setIconifySearch('');
  }, []);

  const searchIconify = useCallback(async (query: string) => {
    const normalizedQuery = query.trim();
    iconifyAbortRef.current?.abort();
    if (!normalizedQuery) {
      resetIconifySearch(false);
      return;
    }
    if (!navigator.onLine) {
      setSearchError('网络未连接，请检查网络设置');
      setIconifyResults([]);
      return;
    }

    const requestId = ++iconifySearchIdRef.current;
    const controller = new AbortController();
    iconifyAbortRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 8000);
    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(normalizedQuery)}&limit=24`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        if (response.status === 429) throw new Error('请求过于频繁，请稍后再试');
        if (response.status >= 500) throw new Error('Iconify 服务暂时不可用，请稍后再试');
        throw new Error(`搜索失败 (${response.status})`);
      }
      const data = await response.json() as IconifySearchResponse;
      if (requestId === iconifySearchIdRef.current) {
        setIconifyResults(data.icons ?? []);
        setFailedIconifyResults(new Set());
      }
    } catch (error) {
      if (requestId !== iconifySearchIdRef.current) return;
      const errorName = error instanceof Error ? error.name : '';
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorName === 'AbortError' && !didTimeout) return;
      setSearchError(didTimeout
        ? '搜索超时，请稍后重试'
        : errorMessage.includes('Failed to fetch') || errorName === 'TypeError'
          ? '网络连接失败，请检查网络后重试'
          : errorMessage || '搜索失败，请稍后重试');
      setIconifyResults([]);
      setFailedIconifyResults(new Set());
    } finally {
      window.clearTimeout(timeoutId);
      if (requestId === iconifySearchIdRef.current) setIsSearching(false);
    }
  }, [resetIconifySearch]);

  const debouncedSearchIconify = useCallback((query: string) => {
    if (iconifyDebounceRef.current) window.clearTimeout(iconifyDebounceRef.current);
    iconifyDebounceRef.current = window.setTimeout(() => searchIconify(query), 400);
  }, [searchIconify]);

  useEffect(() => {
    void preloadImage(DEFAULT_ICON_SOURCE).catch(() => undefined);
    return () => {
      if (iconifyDebounceRef.current) window.clearTimeout(iconifyDebounceRef.current);
      iconifyAbortRef.current?.abort();
      if (customFontFaceRef.current) document.fonts.delete(customFontFaceRef.current);
    };
  }, []);

  const selectIconifyIcon = useCallback((icon: string) => {
    setIconifyIconName(icon);
    setCustomIcon(`https://api.iconify.design/${icon}.svg?color=${encodeURIComponent(iconColor)}`);
    closeIconifyModal();
  }, [closeIconifyModal, iconColor]);

  useEffect(() => {
    if (iconifyIconName) {
      setCustomIcon(`https://api.iconify.design/${iconifyIconName}.svg?color=${encodeURIComponent(iconColor)}`);
    }
  }, [iconColor, iconifyIconName]);

  const handleFontUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    try {
      const file = input.files?.[0];
      if (!file) return;
      const fontFace = await loadFontFile(file);
      if (customFontFaceRef.current) document.fonts.delete(customFontFaceRef.current);
      document.fonts.add(fontFace);
      customFontFaceRef.current = fontFace;
      setCustomFont(fontFace.family);
      setFeedback({ kind: 'success', message: '自定义字体已加载' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '字体加载失败' });
    } finally {
      input.value = '';
    }
  }, []);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bgImage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      imageX: bgImageX,
      imageY: bgImageY
    };
    setIsDragging(true);
  }, [bgImage, bgImageX, bgImageY]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!bgImage || dragStateRef.current.pointerId !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setBgImageX(clamp(
      dragStateRef.current.imageX + (e.clientX - dragStateRef.current.startX) * canvasSize.width / rect.width,
      -canvasSize.width,
      canvasSize.width
    ));
    setBgImageY(clamp(
      dragStateRef.current.imageY + (e.clientY - dragStateRef.current.startY) * canvasSize.height / rect.height,
      -canvasSize.height,
      canvasSize.height
    ));
  }, [bgImage, canvasSize.height, canvasSize.width]);

  const handleCanvasPointerEnd = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragStateRef.current.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    dragStateRef.current.pointerId = -1;
    setIsDragging(false);
  }, []);

  const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!bgImage) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setBgImageScale(prev => Math.max(MIN_BACKGROUND_SCALE, Math.min(prev * delta, MAX_BACKGROUND_SCALE)));
  }, [bgImage]);

  const handleCanvasKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!bgImage) return;
    const step = e.shiftKey ? 20 : 8;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const xDelta = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const yDelta = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      setBgImageX((value) => clamp(value + xDelta, -canvasSize.width, canvasSize.width));
      setBgImageY((value) => clamp(value + yDelta, -canvasSize.height, canvasSize.height));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setBgImageScale((value) => Math.min(MAX_BACKGROUND_SCALE, value * 1.1));
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      setBgImageScale((value) => Math.max(MIN_BACKGROUND_SCALE, value * 0.9));
    } else if (e.key === '0') {
      e.preventDefault();
      resetBackgroundImageControls();
    }
  }, [bgImage, canvasSize.height, canvasSize.width, resetBackgroundImageControls]);

  const buildRenderOptions = useCallback((
    size: { width: number; height: number },
    diagnostics?: { scaled: boolean; truncated: boolean; overflow: boolean; lowContrast: boolean; warnings: string[] },
    overrides?: Partial<Pick<CoverRenderOptions, 'leftText' | 'rightText' | 'subText'>>
  ) => ({
    size,
    template: selectedTemplate,
    layout: layoutMode,
    textAlign,
    leftText: overrides?.leftText ?? leftText,
    rightText: overrides?.rightText ?? rightText,
    subText: overrides?.subText ?? subText,
    fontFamily: customFont || '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontWeight,
    fontSize,
    subFontSize,
    textColor,
    autoTextColor,
    spacing,
    subSpacing,
    textShadow,
    textStroke,
    backgroundImage: bgImage ? { image: bgImage, x: bgImageX, y: bgImageY, scale: bgImageScale, blur: bgBlur, opacity: bgOpacity, fit: bgFit, flipX: bgFlipX, flipY: bgFlipY } : null,
    transparentBackground: exportFormat === 'png' && transparentBackground,
    overlay: { enabled: overlayEnabled, blur: overlayBlur, opacity: overlayOpacity, color: overlayColor },
    icon: { show: showIcon, source: customIcon, size: iconSize, borderRadius: iconBorderRadius, backgroundEnabled: iconBgEnabled },
    fallbackIconSource: DEFAULT_ICON_SOURCE,
    decorations: { showCorners, cornerColor, cornerOpacity, showSeparator, separatorColor, separatorOpacity },
    maxTextLines: layoutMode === 'text-only' ? 3 : 2,
    minFontSize: 18,
    diagnostics,
  }), [
    autoTextColor, bgBlur, bgFit, bgFlipX, bgImage, bgImageScale, bgImageX, bgImageY, bgOpacity, cornerColor, cornerOpacity,
    customFont, customIcon, exportFormat, fontSize, fontWeight, iconBgEnabled, iconBorderRadius, iconSize, layoutMode, leftText,
    overlayBlur, overlayColor, overlayEnabled, rightText, selectedTemplate, separatorColor, separatorOpacity, showCorners, showIcon,
    showSeparator, spacing, subFontSize, subSpacing, subText, textAlign, textColor, textShadow, textStroke, transparentBackground
  ]);

  const renderCanvas = useCallback(async (size: { width: number; height: number }) => {
    const outputCanvas = document.createElement('canvas'); outputCanvas.width = Math.round(size.width); outputCanvas.height = Math.round(size.height);
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) throw new Error('浏览器无法创建封面画布');
    const diagnostics = { scaled: false, truncated: false, overflow: false, lowContrast: false, warnings: [] as string[] };
    await renderCover(outputCtx, buildRenderOptions({ width: outputCanvas.width, height: outputCanvas.height }, diagnostics));
    setRenderWarnings(Array.from(new Set(diagnostics.warnings)));
    return outputCanvas;
  }, [buildRenderOptions]);

  const generateBatch = useCallback(async (items: BatchCoverItem[]) => {
    if (isGenerating || isExporting || !items.length) return;
    const controller = new AbortController();
    batchAbortRef.current = controller;
    setShowBatchDialog(false);
    setBatchProgress({ completed: 0, total: items.length });
    setIsExporting(true);
    setFeedback({ kind: 'info', message: `正在生成批量封面（0/${items.length}）…` });
    try {
      const outputSize = { width: Math.round(canvasSize.width * exportScale), height: Math.round(canvasSize.height * exportScale) };
      const zip = await createBatchZip((async function* () {
        for (const item of items) {
          if (controller.signal.aborted) throw new Error('批量生成已取消');
          const canvas = document.createElement('canvas');
          canvas.width = outputSize.width; canvas.height = outputSize.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('浏览器无法创建批量封面画布');
          const diagnostics = { scaled: false, truncated: false, overflow: false, lowContrast: false, warnings: [] as string[] };
          await renderCover(context, buildRenderOptions(outputSize, diagnostics, { leftText: item.title, rightText: item.subtitle, subText: item.description }));
          const mime = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
          const blob = await canvasToBlob(canvas, mime, exportFormat === 'jpeg' ? jpegQuality / 100 : undefined);
          yield { filename: getExportFilename(item.slug, exportFormat, exportScale), blob };
        }
      })(), (completed) => {
        setBatchProgress({ completed, total: items.length });
        setFeedback({ kind: 'info', message: `正在生成批量封面（${completed}/${items.length}）…` });
      }, controller.signal);
      downloadBlob(zip, `${exportFilename.trim() || 'covers'}-batch.zip`);
      setFeedback({ kind: 'success', message: `批量封面已打包下载，共 ${items.length} 个文件` });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '批量生成失败' });
    } finally {
      batchAbortRef.current = null;
      setBatchProgress(null);
      setIsExporting(false);
    }
  }, [buildRenderOptions, canvasSize, exportFormat, exportFilename, exportScale, isExporting, isGenerating, jpegQuality]);

  const generateCover = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderId = ++renderIdRef.current; setIsGenerating(true);
    try {
      const rendered = await renderCanvas(canvasSize);
      if (renderId !== renderIdRef.current) return;
      canvas.width = rendered.width; canvas.height = rendered.height;
      canvas.getContext('2d')?.drawImage(rendered, 0, 0);
      setFeedback(current => current?.kind === 'error' ? null : current);
    } catch (error) {
      if (renderId === renderIdRef.current) setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '封面生成失败' });
    } finally {
      if (renderId === renderIdRef.current) setIsGenerating(false);
    }
  }, [canvasSize, renderCanvas]);

  const downloadCover = useCallback(async () => {
    if (isGenerating || isExporting) return;
    setIsExporting(true); setFeedback({ kind: 'info', message: '正在生成高清图片，请稍候…' });
    try {
      const size = { width: canvasSize.width * exportScale, height: canvasSize.height * exportScale };
      const outputCanvas = await renderCanvas(size);
      const filename = getExportFilename(exportFilename, exportFormat, exportScale);
      if (exportFormat === 'jpeg' && transparentBackground) {
        const context = outputCanvas.getContext('2d');
        if (context) { context.globalCompositeOperation = 'destination-over'; context.fillStyle = selectedTemplate.id === 'white' ? '#ffffff' : '#000000'; context.fillRect(0, 0, outputCanvas.width, outputCanvas.height); }
      }
      await downloadCanvas(outputCanvas, filename, exportFormat, jpegQuality / 100);
      setFeedback({ kind: 'success', message: `高清封面已导出：${filename}（${outputCanvas.width} × ${outputCanvas.height}px）` });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '下载封面失败' });
    } finally { setIsExporting(false); }
  }, [canvasSize, downloadCanvas, exportFilename, exportFormat, exportScale, isExporting, isGenerating, jpegQuality, renderCanvas, selectedTemplate.id, transparentBackground]);

  const copyToClipboard = useCallback(async () => {
    if (isGenerating || isExporting) return;
    setIsExporting(true); setFeedback({ kind: 'info', message: '正在生成高清图片，请稍候…' });
    try {
      const outputCanvas = await renderCanvas({ width: canvasSize.width * exportScale, height: canvasSize.height * exportScale });
      const result = await copyCanvas(outputCanvas, exportFormat, jpegQuality / 100);
      setCopied(true); setFeedback({ kind: 'success', message: result === 'png-fallback' ? '已复制高清 PNG 到剪贴板（JPEG 已转换为 PNG）' : `已复制高清 ${exportFormat.toUpperCase()} 到剪贴板` });
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) { setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '复制失败，请直接下载' }); }
    finally { setIsExporting(false); }
  }, [canvasSize, exportFormat, exportScale, isExporting, isGenerating, jpegQuality, renderCanvas]);

  const randomizeStyle = useCallback(() => {
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    setSelectedTemplate(randomTemplate);

    const fontSizes = [48, 56, 64, 72, 80, 96];
    const weights = [300, 400, 500, 600, 700, 800, 900];
    const iconSizes = [48, 56, 64, 72, 80, 96, 120];
    const spacings = [16, 24, 32, 40, 48, 60];
    const radii = [0, 4, 8, 12, 16, 24, 50];
    const layouts: LayoutMode[] = showIcon && customIcon ? ['icon-split', 'stacked', 'icon-only', 'text-only'] : ['text-only'];

    setFontSize(fontSizes[Math.floor(Math.random() * fontSizes.length)]);
    setFontWeight(weights[Math.floor(Math.random() * weights.length)]);
    setIconSize(iconSizes[Math.floor(Math.random() * iconSizes.length)]);
    setSpacing(spacings[Math.floor(Math.random() * spacings.length)]);
    setIconBorderRadius(radii[Math.floor(Math.random() * radii.length)]);
    setSubFontSize([20, 24, 28, 32, 36][Math.floor(Math.random() * 5)]);
    setAutoTextColor(true);
    setTextShadow({
      x: Math.floor(Math.random() * 8) - 2,
      y: Math.floor(Math.random() * 8) - 2,
      blur: Math.floor(Math.random() * 16) + 4,
      color: '#000000',
      opacity: Math.random() * 0.5
    });
    setShowCorners(Math.random() > 0.5);
    setShowSeparator(Math.random() > 0.6);
    setLayoutMode(layouts[Math.floor(Math.random() * layouts.length)]);
  }, [customIcon, showIcon]);


  useEffect(() => {
    generateCover();
  }, [generateCover]);

  const inputClass = "editorial-input py-2.5";
  const rangeClass = "w-full accent-ink dark:accent-white";
  const colorClass = "h-11 w-full cursor-pointer rounded-control border border-zinc-300 bg-paper dark:border-zinc-700 dark:bg-zinc-900";
  const cardClass = "editorial-surface overflow-hidden transition-colors";
  const dashedBtnClass = "flex items-center justify-center gap-2 rounded-control border border-dashed border-zinc-400 bg-paper px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-800 dark:active:bg-zinc-800";
  const chipClass = "inline-flex items-center rounded-full border border-zinc-300 bg-paper px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";

  return (
    <div className="pb-20">
      <Seo title="封面生成" description="在线生成精美博客文章封面图片，支持自定义文字、图标、渐变背景与多种导出比例。" />

      <header className="mb-6 border-b border-zinc-200 px-1 pb-7 text-center dark:border-zinc-800 md:pb-9">
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          <Wand2 size={14} />
          COVER STUDIO
        </div>
        <h1 className="mb-3 font-serif text-3xl font-bold tracking-tight text-ink dark:text-white md:text-5xl">封面生成器</h1>
        <p className="mx-auto max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400 md:text-base">
          聚焦博客封面生成体验，保留现有的 <strong>纯黑</strong> 与 <strong>纯白</strong> 两种背景模板，补足更顺手的编辑、预览与导出能力。
        </p>
      </header>

      <div role="tablist" aria-label="封面编辑设置" className="mb-5 flex flex-wrap justify-center gap-1 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {(['content', 'style', 'layout', 'export'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            id={`cover-tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`cover-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={handleTabKeyDown}
            className={`rounded-control px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
            }`}
          >
            {{ content: '内容', style: '样式', layout: '排版', export: '导出' }[tab]}
          </button>
        ))}
      </div>

      {draftRestored && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-surface border border-dashed border-zinc-300 bg-paper px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300" role="status">
          <span>已恢复上次编辑设置；本地图片和字体需要重新上传。</span>
          <button type="button" onClick={() => setDraftRestored(false)} className="shrink-0 rounded-control px-2 py-1 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">知道了</button>
        </div>
      )}

      {renderWarnings.length > 0 && (
        <div className="mb-4 rounded-surface border border-dashed border-amber-500/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/30 dark:text-amber-100" role="status" aria-live="polite">
          <p className="font-semibold">生成提示</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
            {renderWarnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          aria-live={feedback.kind === 'error' ? 'assertive' : 'polite'}
          className={`mb-5 flex items-center justify-between gap-3 rounded-surface border px-4 py-3 text-sm ${
            feedback.kind === 'error'
              ? 'border-dashed border-ink bg-paper font-semibold text-ink dark:border-white dark:bg-zinc-900 dark:text-white'
              : feedback.kind === 'success'
                ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                : 'border-zinc-400 bg-paper text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="关闭提示" title="关闭提示" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control border-l border-current/20 hover:bg-black/5 dark:hover:bg-white/10">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="order-2 min-w-0 space-y-4 lg:order-1 lg:col-span-1">
          {activeTab === 'content' && (
            <div id="cover-panel-content" role="tabpanel" aria-labelledby="cover-tab-content" className="space-y-4">
              <div className={cardClass}>
                <div className="p-5 md:p-6">
                  <SectionHeader
                    icon={<Type size={18} className="text-ink dark:text-white" />}
                    title="文字内容"
                    sectionKey="text-content" collapsed={isCollapsed("text-content")} onToggle={toggleSection}
                    action={
                      <button type="button" aria-label="交换左右文字" onClick={swapMainTexts} className="rounded-icon p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-white" title="交换左右文字">
                        <ArrowLeftRight size={16} />
                      </button>
                    }
                  />
                  {!isCollapsed('text-content') && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="cover-left-text" className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">左侧/主要文字</label>
                          <input id="cover-left-text" type="text" value={leftText} onChange={(e) => setLeftText(e.target.value)} className={inputClass} placeholder="主标题" />
                        </div>
                        <div>
                          <label htmlFor="cover-right-text" className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">右侧文字</label>
                          <input id="cover-right-text" type="text" value={rightText} onChange={(e) => setRightText(e.target.value)} className={inputClass} placeholder="副标题" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="cover-description-text" className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">次要/描述文字</label>
                        <input id="cover-description-text" type="text" value={subText} onChange={(e) => setSubText(e.target.value)} className={inputClass} placeholder="可选描述文字（如：技术博客）" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={chipClass}>主标题 {leftText.length} 字</span>
                        <span className={chipClass}>右侧 {rightText.length} 字</span>
                        <span className={chipClass}>描述 {subText.length} 字</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={cardClass}>
                <div className="p-5 md:p-6">
                  <SectionHeader
                    icon={<ImageIcon size={18} className="text-ink dark:text-white" />}
                    title="图标设置"
                    sectionKey="icon" collapsed={isCollapsed("icon")} onToggle={toggleSection}
                    action={
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={showIcon} onChange={(e) => setShowIcon(e.target.checked)} className="rounded-control accent-ink dark:accent-white" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">显示</span>
                      </label>
                    }
                  />
                  {!isCollapsed('icon') && showIcon && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setShowIconifyModal(true)} className={dashedBtnClass}>
                          <Search size={14} />搜索图标
                        </button>
                        <input ref={iconInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleIconUpload} className="hidden" />
                        <button type="button" onClick={() => iconInputRef.current?.click()} className={dashedBtnClass}>
                          <Upload size={14} />上传图标
                        </button>
                      </div>
                      <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">支持 Iconify 检索或自定义上传图片作为图标素材。</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={cardClass}>
                <div className="p-5 md:p-6">
                  <SectionHeader
                    icon={<Palette size={18} className="text-ink dark:text-white" />}
                    title="背景模板"
                    sectionKey="templates" collapsed={isCollapsed("templates")} onToggle={toggleSection}
                    action={
                      <button
                        type="button"
                        aria-label="随机风格"
                        onClick={randomizeStyle}
                        className="rounded-icon p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-white"
                        title="随机风格"
                      >
                        <Shuffle size={16} />
                      </button>
                    }
                  />
                  {!isCollapsed('templates') && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setSelectedTemplate(template)}
                            aria-pressed={selectedTemplate.id === template.id}
                            className={`group relative h-28 overflow-hidden rounded-surface border transition-colors ${
                              selectedTemplate.id === template.id
                                ? 'border-ink ring-2 ring-ink/10 dark:border-white dark:ring-white/10'
                                : 'border-zinc-200/80 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
                            }`}
                            style={{ background: template.gradient }}
                            title={template.description || template.name}
                          >
                            <div className="absolute inset-x-0 bottom-0 p-4 text-left">
                              <div className={`text-base font-bold ${template.id === 'white' ? 'text-ink' : 'text-white'}`}>{template.name}</div>
                              <div className={`mt-1 text-xs ${template.id === 'white' ? 'text-zinc-600' : 'text-white/70'}`}>{template.description}</div>
                            </div>
                            {selectedTemplate.id === template.id && (
                              <div className="absolute right-3 top-3 rounded-micro bg-white/80 px-2 py-1 text-[11px] font-bold text-ink shadow-none dark:bg-zinc-800/80 dark:text-white">当前</div>
                            )}
                          </button>
                        ))}
                      </div>
                      <div
                        className={`rounded-surface border border-dashed p-3 transition-colors ${bgDragActive
                          ? 'border-ink bg-ink/5 dark:border-white dark:bg-white/10'
                          : 'border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-800/60'}`}
                        onDragOver={handleBgDragOver}
                        onDragLeave={handleBgDragLeave}
                        onDrop={handleBgDrop}
                      >
                        <p className="mb-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">背景模板固定保留现有两种：<strong>纯黑</strong> 与 <strong>纯白</strong>。自定义图片会叠加在底色上，可在白底下调节透明度。</p>
                        <input ref={bgImageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBgImageUpload} className="hidden" />
                        <button type="button" onClick={() => bgImageInputRef.current?.click()} className={dashedBtnClass + ' w-full'}>
                          <Upload size={14} />{bgDragActive ? '松开即可导入' : '上传或拖入背景图片'}
                        </button>
                        <p className="mt-2 text-center text-[11px] text-zinc-400">支持 PNG、JPEG、WebP，最大 10MB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'style' && (
            <div id="cover-panel-style" role="tabpanel" aria-labelledby="cover-tab-style" className="space-y-4">
              <div className={cardClass}>
                <div className="p-5 md:p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles size={18} className="text-ink dark:text-white" />
                    <h2 className="font-bold text-ink dark:text-white">快捷预设</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: '默认', action: () => { setFontSize(72); setFontWeight(700); setIconSize(80); setSpacing(32); setTextShadow({ x: 2, y: 2, blur: 8, color: '#000000', opacity: 0.3 }); setTextStroke({ enabled: false, width: 2, color: '#000000' }); setIconBorderRadius(12); setIconBgEnabled(true); setShowCorners(false); setShowSeparator(false); } },
                      { name: '醒目', action: () => { setFontSize(80); setFontWeight(900); setIconSize(100); setSpacing(40); setTextShadow({ x: 4, y: 4, blur: 12, color: '#000000', opacity: 0.5 }); setTextStroke({ enabled: true, width: 4, color: '#000000' }); setIconBorderRadius(20); setIconBgEnabled(true); setShowCorners(false); setShowSeparator(false); } },
                      { name: '简约', action: () => { setFontSize(56); setFontWeight(400); setIconSize(56); setSpacing(20); setTextShadow({ x: 0, y: 0, blur: 0, color: '#000000', opacity: 0 }); setTextStroke({ enabled: false, width: 2, color: '#000000' }); setIconBorderRadius(0); setIconBgEnabled(false); setShowCorners(false); setShowSeparator(false); } },
                      { name: '柔和', action: () => { setFontSize(64); setFontWeight(500); setIconSize(68); setSpacing(28); setTextShadow({ x: 0, y: 4, blur: 14, color: '#000000', opacity: 0.3 }); setTextStroke({ enabled: false, width: 2, color: '#000000' }); setIconBorderRadius(50); setIconBgEnabled(true); setShowCorners(false); setShowSeparator(false); } },
                      { name: '杂志', action: () => { setFontSize(68); setFontWeight(800); setIconSize(64); setSpacing(36); setTextShadow({ x: 1, y: 1, blur: 4, color: '#000000', opacity: 0.2 }); setTextStroke({ enabled: false, width: 2, color: '#000000' }); setIconBorderRadius(4); setIconBgEnabled(true); setShowCorners(true); setShowSeparator(true); setLayoutMode('stacked'); } },
                      { name: '极简', action: () => { setFontSize(96); setFontWeight(300); setSpacing(24); setTextShadow({ x: 0, y: 0, blur: 0, color: '#000000', opacity: 0 }); setTextStroke({ enabled: false, width: 2, color: '#000000' }); setShowIcon(false); setShowCorners(false); setShowSeparator(false); setLayoutMode('text-only'); } },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={preset.action}
                        className="rounded-control border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={resetStyleSettings} className="mt-3 flex w-full items-center justify-center gap-2 rounded-control border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:border-ink hover:text-ink dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
                    <RotateCcw size={14} />重置样式参数
                  </button>
                </div>
              </div>


              <div className={cardClass}>
                <div className="p-5">
                  <SectionHeader icon={<Type size={18} className="text-ink dark:text-white" />} title="文字样式" sectionKey="text-style" collapsed={isCollapsed("text-style")} onToggle={toggleSection} />
                  {!isCollapsed('text-style') && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>字体大小</span>
                          <span className="text-ink dark:text-white tabular-nums">{fontSize}px</span>
                        </label>
                        <input type="range" min="24" max="120" value={fontSize} aria-label="字体大小" aria-valuetext={`${fontSize}px`} onChange={(e) => setFontSize(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>副标题大小</span>
                          <span className="text-ink dark:text-white tabular-nums">{subFontSize}px</span>
                        </label>
                            <input type="range" min="16" max="48" value={subFontSize} aria-label="副标题大小" aria-valuetext={`${subFontSize}px`} onChange={(e) => setSubFontSize(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>文字间距</span>
                          <span className="text-ink dark:text-white tabular-nums">{spacing}px</span>
                        </label>
                            <input type="range" min="0" max="120" value={spacing} aria-label="文字间距" aria-valuetext={`${spacing}px`} onChange={(e) => setSpacing(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>字体粗细</span>
                          <span className="text-ink dark:text-white tabular-nums">{fontWeight}</span>
                        </label>
                            <input type="range" min="100" max="900" step="100" value={fontWeight} aria-label="字体粗细" aria-valuetext={`${fontWeight}`} onChange={(e) => setFontWeight(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={autoTextColor} onChange={(e) => setAutoTextColor(e.target.checked)} className="rounded-control accent-ink dark:accent-white" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">自动反色（根据背景）</span>
                      </label>
                      {!autoTextColor && (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">文字颜色</label>
                          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className={colorClass} />
                        </div>
                      )}
                      <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} className="hidden" />
                      <button type="button" onClick={() => fontInputRef.current?.click()} className={dashedBtnClass + ' w-full'}>
                        <Upload size={14} />上传自定义字体
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={cardClass}>
                <div className="p-5">
                  <SectionHeader
                    icon={<Type size={18} className="text-ink dark:text-white" />}
                    title="文字描边"
                    sectionKey="stroke" collapsed={isCollapsed("stroke")} onToggle={toggleSection}
                    action={
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={textStroke.enabled} onChange={(e) => setTextStroke({ ...textStroke, enabled: e.target.checked })} className="rounded-control accent-ink dark:accent-white" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">启用</span>
                      </label>
                    }
                  />
                  {!isCollapsed('stroke') && textStroke.enabled && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>描边宽度</span><span className="tabular-nums">{textStroke.width}px</span>
                        </label>
                            <input type="range" min="1" max="10" value={textStroke.width} aria-label="描边宽度" aria-valuetext={`${textStroke.width}px`} onChange={(e) => setTextStroke({ ...textStroke, width: Number(e.target.value) })} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">描边颜色</label>
                        <input type="color" value={textStroke.color} onChange={(e) => setTextStroke({ ...textStroke, color: e.target.value })} className={colorClass} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={cardClass}>
                <div className="p-5">
                  <SectionHeader icon={<Type size={18} className="text-ink dark:text-white" />} title="文字阴影" sectionKey="shadow" collapsed={isCollapsed("shadow")} onToggle={toggleSection} />
                  {!isCollapsed('shadow') && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>透明度</span><span className="tabular-nums">{Math.round(textShadow.opacity * 100)}%</span>
                        </label>
                        <input type="range" min="0" max="1" step="0.1" value={textShadow.opacity} aria-label="阴影透明度" aria-valuetext={`${Math.round(textShadow.opacity * 100)}%`} onChange={(e) => setTextShadow({ ...textShadow, opacity: Number(e.target.value) })} className={rangeClass} />
                      </div>
                      {textShadow.opacity > 0 && (
                        <>
                          <div>
                            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                              <span>模糊半径</span><span className="tabular-nums">{textShadow.blur}px</span>
                            </label>
                            <input type="range" min="0" max="40" value={textShadow.blur} onChange={(e) => setTextShadow({ ...textShadow, blur: Number(e.target.value) })} className={rangeClass} />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                <span>X 偏移</span><span className="tabular-nums">{textShadow.x}px</span>
                              </label>
                              <input type="range" min="-20" max="20" value={textShadow.x} onChange={(e) => setTextShadow({ ...textShadow, x: Number(e.target.value) })} className={rangeClass} />
                            </div>
                            <div>
                              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                <span>Y 偏移</span><span className="tabular-nums">{textShadow.y}px</span>
                              </label>
                              <input type="range" min="-20" max="20" value={textShadow.y} onChange={(e) => setTextShadow({ ...textShadow, y: Number(e.target.value) })} className={rangeClass} />
                            </div>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">阴影颜色</label>
                            <input type="color" value={textShadow.color} onChange={(e) => setTextShadow({ ...textShadow, color: e.target.value })} className={colorClass} />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {showIcon && (
                <div className={cardClass}>
                  <div className="p-5">
                    <SectionHeader icon={<ImageIcon size={18} className="text-ink dark:text-white" />} title="图标样式" sectionKey="icon-style" collapsed={isCollapsed("icon-style")} onToggle={toggleSection} />
                    {!isCollapsed('icon-style') && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>大小</span><span className="tabular-nums">{iconSize}px</span>
                          </label>
                          <input type="range" min="32" max="200" value={iconSize} onChange={(e) => setIconSize(Number(e.target.value))} className={rangeClass} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">图标颜色</label>
                          <input type="color" value={iconColor} onChange={(e) => setIconColor(e.target.value)} className={colorClass} />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>圆角</span><span className="tabular-nums">{iconBorderRadius}%</span>
                          </label>
                          <input type="range" min="0" max="50" value={iconBorderRadius} onChange={(e) => setIconBorderRadius(Number(e.target.value))} className={rangeClass} />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={iconBgEnabled} onChange={(e) => setIconBgEnabled(e.target.checked)} className="rounded-control accent-ink dark:accent-white" />
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">显示图标背景</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={cardClass}>
                <div className="p-5">
                  <SectionHeader
                    icon={<Palette size={18} className="text-ink dark:text-white" />}
                    title="背景遮罩"
                    sectionKey="overlay" collapsed={isCollapsed("overlay")} onToggle={toggleSection}
                    action={
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={overlayEnabled} onChange={(e) => setOverlayEnabled(e.target.checked)} className="rounded-control accent-ink dark:accent-white" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">启用</span>
                      </label>
                    }
                  />
                  {!isCollapsed('overlay') && overlayEnabled && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">遮罩颜色</label>
                        <input type="color" value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} className={colorClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>模糊</span><span className="tabular-nums">{overlayBlur}px</span>
                        </label>
                        <input type="range" min="0" max="20" value={overlayBlur} onChange={(e) => setOverlayBlur(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>透明度</span><span className="tabular-nums">{overlayOpacity}%</span>
                        </label>
                        <input type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))} className={rangeClass} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {bgImage && (
                <div className={cardClass}>
                  <div className="p-5">
                    <SectionHeader icon={<ImageIcon size={18} className="text-ink dark:text-white" />} title="背景图片" sectionKey="bg-image" collapsed={isCollapsed("bg-image")} onToggle={toggleSection} />
                    {!isCollapsed('bg-image') && (
                      <div className="space-y-4">
                        {bgFileName && (
                          <div className="flex items-center gap-3 rounded-control bg-zinc-50 p-2.5 dark:bg-zinc-800">
                            <div className="h-12 w-16 shrink-0 overflow-hidden rounded-micro bg-zinc-200 dark:bg-zinc-700">
                              {bgImage && <img src={bgImage.src} alt="背景图片缩略图" className="h-full w-full object-cover" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-ink dark:text-white">{bgFileName}</p>
                              <p className="mt-1 text-[11px] text-zinc-400">{bgImage ? `${bgImage.naturalWidth} × ${bgImage.naturalHeight}px` : '已加载'} · 可继续调整</p>
                            </div>
                            <button type="button" onClick={() => bgImageInputRef.current?.click()} className="rounded-control px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700">替换</button>
                          </div>
                        )}
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>缩放</span><span className="tabular-nums">{bgImageScale.toFixed(2)}x</span>
                          </label>
                          <input type="range" min={MIN_BACKGROUND_SCALE} max={MAX_BACKGROUND_SCALE} step="0.05" value={bgImageScale} onChange={(e) => setBgImageScale(Number(e.target.value))} className={rangeClass} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400"><span>水平位置</span><span>{bgImageX}px</span></label>
                            <input type="range" min={-canvasSize.width} max={canvasSize.width} value={bgImageX} onChange={(e) => setBgImageX(Number(e.target.value))} className={rangeClass} />
                          </div>
                          <div>
                            <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400"><span>垂直位置</span><span>{bgImageY}px</span></label>
                            <input type="range" min={-canvasSize.height} max={canvasSize.height} value={bgImageY} onChange={(e) => setBgImageY(Number(e.target.value))} className={rangeClass} />
                          </div>
                        </div>
                        <div>
                          <span className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">图片适配</span>
                          <div className="grid grid-cols-2 gap-2">
                            {([{ value: 'cover' as BackgroundFit, label: '铺满裁剪' }, { value: 'contain' as BackgroundFit, label: '完整显示' }]).map(option => (
                              <button type="button" key={option.value} onClick={() => { setBgFit(option.value); setBgImageX(0); setBgImageY(0); }} aria-pressed={bgFit === option.value} className={`rounded-control border-2 px-3 py-2 text-xs font-semibold transition-colors ${bgFit === option.value ? 'border-ink bg-ink/5 text-ink dark:border-white dark:bg-white/10 dark:text-white' : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400'}`}>{option.label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setBgFlipX(value => !value)} aria-pressed={bgFlipX} className="rounded-control border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">水平翻转 {bgFlipX ? '✓' : ''}</button>
                          <button type="button" onClick={() => setBgFlipY(value => !value)} aria-pressed={bgFlipY} className="rounded-control border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">垂直翻转 {bgFlipY ? '✓' : ''}</button>
                        </div>
                        <button type="button" onClick={() => setSelectedTemplate(templates.find(template => template.id === 'white') || selectedTemplate)} className="w-full rounded-control border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">切换到纯白底</button>
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400"><span>模糊</span><span className="tabular-nums">{bgBlur}px</span></label>
                          <input type="range" min="0" max="20" value={bgBlur} onChange={(e) => setBgBlur(Number(e.target.value))} className={rangeClass} />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400"><span>不透明度</span><span className="tabular-nums">{bgOpacity}%</span></label>
                          <input type="range" min="0" max="100" value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} className={rangeClass} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => { setBgImageX(0); setBgImageY(0); }} className="rounded-control border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">居中</button>
                          <button type="button" onClick={resetBackgroundImageControls} className="rounded-control border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">重置参数</button>
                        </div>
                        <button type="button" onClick={() => { bgImageLoadGenerationRef.current += 1; setBgImage(null); setBgFileName(null); resetBackgroundImageControls(); }} className="flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-zinc-500 bg-paper px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:hover:border-white dark:hover:bg-zinc-800 dark:active:bg-zinc-800">
                          <X size={14} />移除背景图片
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'layout' && (
            <div id="cover-panel-layout" role="tabpanel" aria-labelledby="cover-tab-layout" className="space-y-4">
              <div className={cardClass}>
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Layout size={18} className="text-ink dark:text-white" />
                    <h2 className="font-bold text-ink dark:text-white">布局模式</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { mode: 'icon-split' as LayoutMode, icon: SplitSquareHorizontal, label: '图标分列', desc: '图标居中，文字在两侧' },
                      { mode: 'stacked' as LayoutMode, icon: AlignCenter, label: '垂直堆叠', desc: '图标在上，文字在下' },
                      { mode: 'icon-only' as LayoutMode, icon: ImageIcon, label: '仅图标', desc: '图标居中，不显示文字' },
                      { mode: 'text-only' as LayoutMode, icon: Type, label: '纯文字', desc: '仅显示文字内容' },
                    ]).map(({ mode, icon: Icon, label, desc }) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setLayoutMode(mode)}
                        aria-pressed={layoutMode === mode}
                        className={`flex flex-col items-center gap-1 rounded-control border-2 p-3 transition-colors ${
                          layoutMode === mode
                            ? 'border-ink bg-ink/5 dark:border-white dark:bg-white/10'
                            : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
                        }`}
                      >
                        <Icon size={22} className={layoutMode === mode ? 'text-ink dark:text-white' : 'text-zinc-400'} />
                        <span className={`text-xs font-semibold ${layoutMode === mode ? 'text-ink dark:text-white' : 'text-zinc-500'}`}>{label}</span>
                        <span className="text-[10px] text-zinc-400 leading-tight text-center">{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={cardClass}>
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <AlignLeft size={18} className="text-ink dark:text-white" />
                    <h2 className="font-bold text-ink dark:text-white">文字对齐</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { align: 'left' as TextAlign, icon: AlignLeft, label: '左对齐' },
                      { align: 'center' as TextAlign, icon: AlignCenter, label: '居中' },
                      { align: 'right' as TextAlign, icon: AlignRight, label: '右对齐' },
                    ]).map(({ align, icon: Icon, label }) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => setTextAlign(align)}
                        aria-pressed={textAlign === align}
                        className={`flex flex-col items-center gap-1 rounded-control border-2 p-3 transition-colors ${
                          textAlign === align
                            ? 'border-ink bg-ink/5 dark:border-white dark:bg-white/10'
                            : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
                        }`}
                      >
                        <Icon size={22} className={textAlign === align ? 'text-ink dark:text-white' : 'text-zinc-400'} />
                        <span className={`text-xs font-semibold ${textAlign === align ? 'text-ink dark:text-white' : 'text-zinc-500'}`}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={cardClass}>
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Frame size={18} className="text-ink dark:text-white" />
                    <h2 className="font-bold text-ink dark:text-white">装饰元素</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={showCorners} onChange={(e) => setShowCorners(e.target.checked)} className="rounded-control accent-ink dark:accent-white" />
                        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">角标装饰</span>
                      </label>
                    </div>
                    {showCorners && (
                      <div className="space-y-3 pl-6 border-l-2 border-zinc-100 dark:border-zinc-800">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">角标颜色</label>
                          <input type="color" value={cornerColor} onChange={(e) => setCornerColor(e.target.value)} className={colorClass} />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>角标透明度</span><span className="tabular-nums">{cornerOpacity}%</span>
                          </label>
                          <input type="range" min="10" max="100" value={cornerOpacity} onChange={(e) => setCornerOpacity(Number(e.target.value))} className={rangeClass} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={showSeparator} onChange={(e) => setShowSeparator(e.target.checked)} className="rounded-control accent-ink dark:accent-white" />
                        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">分隔线</span>
                      </label>
                    </div>
                    {showSeparator && (
                      <div className="space-y-3 pl-6 border-l-2 border-zinc-100 dark:border-zinc-800">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">分隔线颜色</label>
                          <input type="color" value={separatorColor} onChange={(e) => setSeparatorColor(e.target.value)} className={colorClass} />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>透明度</span><span className="tabular-nums">{separatorOpacity}%</span>
                          </label>
                          <input type="range" min="10" max="100" value={separatorOpacity} onChange={(e) => setSeparatorOpacity(Number(e.target.value))} className={rangeClass} />
                        </div>
                      </div>
                    )}


                  </div>
                </div>
              </div>
            </div>
          )}




          {activeTab === 'export' && (
            <div id="cover-panel-export" role="tabpanel" aria-labelledby="cover-tab-export" className="space-y-4">
              <div className={cardClass}>
                <div className="p-5 md:p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Download size={18} className="text-ink dark:text-white" />
                    <h2 className="font-bold text-ink dark:text-white">导出设置</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span id="cover-ratio-label" className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">宽高比</span>
                      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4" role="group" aria-labelledby="cover-ratio-label">
                        {COVER_RATIOS.map((ratio) => (
                          <button
                            key={ratio.label}
                            title={`输出比例 ${ratio.label}`}
                            type="button"
                            onClick={() => setActiveRatioLabel(ratio.label)}
                            aria-pressed={activeRatioLabel === ratio.label}
                            className={`rounded-control border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                              activeRatioLabel === ratio.label
                                ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                                : 'border-zinc-200 text-zinc-600 hover:border-ink dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-white'
                            }`}
                          >
                            {ratio.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span id="cover-format-label" className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">格式</span>
                      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="cover-format-label">
                        {(['png', 'jpeg'] as const).map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setExportFormat(f)}
                            aria-pressed={exportFormat === f}
                            className={`rounded-control border-2 px-3 py-2 text-sm font-semibold uppercase transition-colors ${
                              exportFormat === f
                                ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                                : 'border-zinc-200 text-zinc-600 hover:border-ink dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-white'
                            }`}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="cover-export-scale" className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        <span>导出倍率</span>
                        <span className="tabular-nums text-ink dark:text-white">{exportScale}x</span>
                      </label>
                      <input id="cover-export-scale" type="range" min={MIN_EXPORT_SCALE} max={MAX_EXPORT_SCALE} step="0.5" value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))} aria-valuetext={`${exportScale} 倍`} className={rangeClass} />
                      <p className="mt-1 text-xs text-zinc-400">下载时将输出为 {Math.round(canvasSize.width * exportScale)} × {Math.round(canvasSize.height * exportScale)} px</p>
                    </div>
                    <div>
                      <span id="cover-background-label" className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">导出背景</span>
                      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="cover-background-label">
                        <button type="button" onClick={() => setTransparentBackground(false)} aria-pressed={!transparentBackground} className={`rounded-control border-2 px-3 py-2 text-xs font-semibold ${!transparentBackground ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink' : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'}`}>跟随模板底色</button>
                        <button type="button" onClick={() => { if (exportFormat === 'png') setTransparentBackground(true); }} disabled={exportFormat !== 'png'} aria-pressed={transparentBackground && exportFormat === 'png'} className={`rounded-control border-2 px-3 py-2 text-xs font-semibold ${transparentBackground && exportFormat === 'png' ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink' : 'border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'} disabled:cursor-not-allowed disabled:opacity-40`}>透明背景（PNG）</button>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">透明背景会在预览中显示棋盘格，JPEG 始终使用模板底色。</p>
                    </div>
                    {exportFormat === 'jpeg' && (
                      <div>
                        <label htmlFor="cover-jpeg-quality" className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400"><span>JPEG 质量</span><span className="tabular-nums">{jpegQuality}%</span></label>
                        <input id="cover-jpeg-quality" type="range" min="60" max="100" value={jpegQuality} onChange={(e) => setJpegQuality(Number(e.target.value))} className={rangeClass} />
                      </div>
                    )}
                    <div>
                      <label htmlFor="cover-export-filename" className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">文件名</label>
                      <input id="cover-export-filename" type="text" value={exportFilename} onChange={(e) => setExportFilename(e.target.value)} className={inputClass} placeholder="cover" />
                    </div>
                  </div>
                </div>
              </div>

              <div className={cardClass}>
                <div className="p-5 md:p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles size={18} className="text-ink dark:text-white" />
                    <h2 className="font-bold text-ink dark:text-white">我的预设</h2>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') savePreset(); }}
                      className={`${inputClass} min-w-0 flex-1`}
                      placeholder="预设名称（可选）"
                      aria-label="预设名称"
                    />
                    <button type="button" onClick={savePreset} className="shrink-0 rounded-control bg-ink px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-ink dark:hover:bg-zinc-200">保存</button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">预设只保存文字和样式设置；本地图片、上传字体不会写入浏览器存储。</p>
                  {presets.length > 0 ? (
                    <ul className="mt-3 space-y-2" aria-label="已保存预设">
                      {presets.map((preset) => (
                        <li key={`${preset.name}-${preset.createdAt}`} className="flex items-center gap-2 rounded-control border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink dark:text-white">{preset.name}</span>
                          <button type="button" onClick={() => loadPreset(preset)} className="rounded-control px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-ink dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white">加载</button>
                          <button type="button" onClick={() => removePreset(preset.name)} className="rounded-control px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white" aria-label={`删除预设：${preset.name}`}>删除</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-400">还没有保存的预设。</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={generateCover}
                  disabled={isGenerating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-control border border-zinc-200 bg-zinc-100 px-4 py-2.5 font-semibold text-ink transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                >
                  <RefreshCw size={18} className={isGenerating && !shouldReduceMotion ? 'animate-spin' : ''} />
                  重新生成
                </button>

                <button
                  type="button"
                  onClick={() => setShowBatchDialog(true)}
                  disabled={isGenerating || isExporting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-control border border-zinc-400 px-4 py-2.5 font-semibold text-zinc-700 transition-colors hover:border-ink hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-900"
                >
                  <Upload size={18} />
                  批量生成 ZIP
                </button>

                <button
                  type="button"
                  onClick={downloadCover}
                  disabled={isGenerating || isExporting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-control border border-ink bg-ink px-4 py-2.5 font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-ink dark:hover:bg-zinc-200"
                >
                  <Download size={18} />
                  下载封面
                </button>

                <button
                  type="button"
                  onClick={copyToClipboard}
                  disabled={isGenerating}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-control border px-4 py-2.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    copied
                      ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                      : 'border-zinc-400 text-zinc-700 hover:border-ink hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-900'
                  }`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? '已复制' : '复制到剪贴板'}
                </button>

                <button type="button" onClick={resetAllSettings} className="flex items-center justify-center gap-2 rounded-control border border-dashed border-zinc-500 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:border-ink hover:bg-zinc-100 hover:text-ink dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-900 dark:hover:text-white">
                  <RotateCcw size={16} />重置全部设置
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="order-1 min-w-0 lg:order-2 lg:col-span-2">
          <div className="editorial-surface min-w-0 p-4 md:p-5 lg:sticky lg:top-24">
            <div className="mb-4 flex flex-col gap-4 border-b border-zinc-200/70 pb-4 dark:border-zinc-800/80 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="text-ink dark:text-white" size={20} />
                  <h2 className="font-bold text-ink dark:text-white">实时预览</h2>
                  {isGenerating && <span className="bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300" role="status" aria-live="polite">生成中</span>}
                </div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">当前画布：{canvasSize.width} × {canvasSize.height} px，可直接预览黑白模板与图片叠加效果。</p>
              </div>
              <div className="flex flex-wrap gap-2 md:max-w-[50%] md:justify-end">
                {quickStats.map((item) => (
                  <span key={item.label} className={chipClass}>
                    <strong className="mr-1 text-zinc-900 dark:text-white">{item.label}</strong>{item.value}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowGuides((value) => !value)} aria-pressed={showGuides} className="inline-flex items-center gap-2 rounded-control border border-zinc-300 bg-paper px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-800">安全框/中心线</button>
              <button type="button" onClick={() => setShowGrid((value) => !value)} aria-pressed={showGrid} className="inline-flex items-center gap-2 rounded-control border border-zinc-300 bg-paper px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-800">网格</button>
              <button type="button" onClick={undo} disabled={!canUndo} className="inline-flex items-center gap-2 rounded-control border border-zinc-300 bg-paper px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:bg-zinc-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-800" title="撤销（Ctrl/Cmd + Z）">
                撤销
              </button>
              <button type="button" onClick={redo} disabled={!canRedo} className="inline-flex items-center gap-2 rounded-control border border-zinc-300 bg-paper px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:bg-zinc-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-800" title="重做（Ctrl/Cmd + Shift + Z）">
                重做
              </button>
              <button type="button" onClick={randomizeStyle} className="inline-flex items-center gap-2 rounded-control border border-zinc-300 bg-paper px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:bg-zinc-100 hover:text-ink active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-800 dark:hover:text-white dark:active:bg-zinc-800">
                <Shuffle size={16} />随机样式
              </button>
                <button type="button" onClick={generateCover} className="inline-flex items-center gap-2 rounded-control border border-zinc-300 bg-paper px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-ink active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white dark:active:bg-zinc-800">
                <RefreshCw size={16} className={isGenerating && !shouldReduceMotion ? 'animate-spin' : ''} />刷新预览
              </button>
              {bgImage && (
                <button type="button" onClick={resetBackgroundImageControls} className="inline-flex items-center gap-2 rounded-control border border-zinc-300 bg-paper px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-ink active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white dark:active:bg-zinc-800">
                  <RotateCcw size={16} />重置背景位置
                </button>
              )}
            </div>

            <p id="cover-preview-help" className="sr-only">预览获得焦点后，可使用方向键移动背景，Shift 加速；加号和减号调整缩放，数字 0 重置背景位置。</p>
            <div className="overflow-hidden rounded-surface border border-zinc-200 bg-zinc-100 p-2 dark:border-zinc-700 dark:bg-zinc-800 md:p-3">
              <div
                className={`overflow-hidden rounded-media border border-zinc-200 dark:border-zinc-700 ${transparentBackground && exportFormat === 'png' ? 'bg-[length:16px_16px] bg-[linear-gradient(45deg,#e4e4e7_25%,transparent_25%),linear-gradient(-45deg,#e4e4e7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e4e4e7_75%),linear-gradient(-45deg,transparent_75%,#e4e4e7_75%)] bg-[position:0_0,0_8px,8px_-8px,-8px_0] bg-zinc-50 dark:bg-zinc-900 dark:bg-[linear-gradient(45deg,#3f3f46_25%,transparent_25%),linear-gradient(-45deg,#3f3f46_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#3f3f46_75%),linear-gradient(-45deg,transparent_75%,#3f3f46_75%)]' : 'bg-zinc-50 dark:bg-zinc-900'}`}
              >
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={canvasSize.width}
                    height={canvasSize.height}
                    tabIndex={0}
                    aria-label={bgImage ? '封面预览，可拖动调整背景图片位置' : '封面预览'}
                    aria-describedby="cover-preview-help"
                    className={`block h-auto max-w-full select-none outline-none focus-visible:ring-2 focus-visible:ring-ink dark:focus-visible:ring-white ${bgImage ? isDragging ? 'cursor-grabbing' : 'cursor-grab' : 'cursor-default'}`}
                    style={{ aspectRatio: `${activeRatio.w}/${activeRatio.h}`, touchAction: bgImage ? 'none' : 'auto' }}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={handleCanvasPointerEnd}
                    onPointerCancel={handleCanvasPointerEnd}
                    onWheel={handleCanvasWheel}
                    onKeyDown={handleCanvasKeyDown}
                  />
                  {showGuides && (
                    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                      <div className="absolute inset-[6.67%] border border-amber-400/80" />
                      <div className="absolute inset-y-0 left-1/2 border-l border-amber-400/60" />
                      <div className="absolute inset-x-0 top-1/2 border-t border-amber-400/60" />
                    </div>
                  )}
                  {showGrid && (
                    <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(to right, rgba(245,158,11,.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,158,11,.5) 1px, transparent 1px)', backgroundSize: '10% 10%' }} />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-surface border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">当前模板</div>
                <div className="mt-2 text-lg font-bold text-ink dark:text-white">{selectedTemplate.name}</div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">只保留现有黑白模板，避免风格面板过度分散。</p>
              </div>
              <div className="rounded-surface border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">预览提示</div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{bgImage ? '已启用背景图：鼠标或触屏拖动可调整位置，滚轮可缩放。' : '当前为纯模板预览：上传背景图可增加层次感。'}</p>
              </div>
              <div className="rounded-surface border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">导出结果</div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">文件将以 <strong>{exportFilename.trim() || 'cover'}</strong> 导出，格式为 <strong>{exportFormat.toUpperCase()}</strong>。</p>
              </div>
            </div>

            <div className="mt-4 rounded-surface bg-zinc-50 p-4 dark:bg-zinc-800">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 shrink-0 text-ink dark:text-white" size={16} />
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <p className="font-semibold">使用提示：</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-6">
                    <li>- <strong>内容</strong>：编辑主标题、副标题、图标与黑白模板。</li>
                    <li>- <strong>样式</strong>：调节字体、颜色、阴影、描边，并支持一键重置样式。</li>
                    <li>- <strong>排版</strong>：切换布局模式、文字对齐与装饰元素。</li>
                    <li>- <strong>导出</strong>：支持比例、格式、倍率与文件名配置，倍率现在会真正影响下载尺寸。</li>
                    <li>- 上传背景图片后可用鼠标或触屏拖动位置、滚轮缩放，并用“重置背景位置”快速归位。</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {batchProgress && (
        <div className="fixed inset-x-4 bottom-4 z-modal mx-auto max-w-md rounded-control border border-zinc-300 bg-paper p-4 text-sm text-ink shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3"><span>批量生成中</span><strong>{batchProgress.completed}/{batchProgress.total}</strong></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"><div className="h-full bg-ink transition-[width] dark:bg-white" style={{ width: `${batchProgress.total ? batchProgress.completed / batchProgress.total * 100 : 0}%` }} /></div>
          <button type="button" onClick={() => batchAbortRef.current?.abort()} className="mt-3 rounded-control border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:border-ink dark:border-zinc-700 dark:hover:border-white">取消</button>
        </div>
      )}

      <BatchCoverDialog isOpen={showBatchDialog} onClose={() => setShowBatchDialog(false)} onGenerate={generateBatch} />

      <AnimatePresence>
        {showIconifyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
            onClick={closeIconifyModal}
          >
            <motion.div
              ref={iconifyDialogRef}
              tabIndex={-1}
              initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { scale: 0.98, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.01 : 0.16 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="iconify-dialog-title"
              className="editorial-overlay flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-5 supports-[height:100dvh]:max-h-[90dvh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="iconify-dialog-title" className="text-xl font-bold text-ink dark:text-white">搜索 Iconify 图标</h2>
                <button type="button" onClick={closeIconifyModal} aria-label="关闭图标搜索" title="关闭" className="rounded-icon p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="mb-4">
                <SearchField
                  ref={iconSearchInputRef}
                  value={iconifySearch}
                  onValueChange={(value) => {
                    setIconifySearch(value);
                    if (!value.trim()) resetIconifySearch(false);
                    else debouncedSearchIconify(value);
                  }}
                  onClear={() => resetIconifySearch(true)}
                  placeholder="搜索图标，例如：home, user, settings..."
                  aria-label="搜索 Iconify 图标"
                />
                {searchError && (
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: shouldReduceMotion ? 0.01 : 0.14 }}
                    className="mt-2 flex items-center gap-2 rounded-control border border-dashed border-ink bg-paper px-3 py-2 text-sm font-semibold text-ink dark:border-white dark:bg-zinc-900 dark:text-white"
                  >
                    <X size={16} /><span>{searchError}</span>
                  </motion.div>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-12"><RefreshCw className={shouldReduceMotion ? 'text-ink dark:text-white' : 'animate-spin text-ink dark:text-white'} size={32} /></div>
                ) : iconifyResults.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {iconifyResults.map((icon) => (
                      <button type="button" key={icon} onClick={() => selectIconifyIcon(icon)}
                        className="flex aspect-square items-center justify-center rounded-control border-2 border-zinc-200 bg-zinc-50 p-3 transition-colors hover:border-ink hover:bg-ink/5 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-white dark:hover:bg-white/5"
                        title={icon}>
                        <img
                          src={failedIconifyResults.has(icon) ? DEFAULT_ICON_SOURCE : `https://api.iconify.design/${icon}.svg`}
                          alt={icon}
                          className="h-full w-full object-contain"
                          onError={(event) => {
                            if (!failedIconifyResults.has(icon)) {
                              setFailedIconifyResults((current) => new Set(current).add(icon));
                              event.currentTarget.src = DEFAULT_ICON_SOURCE;
                            }
                          }}
                        />
                      </button>
                    ))}
                  </div>
                ) : iconifySearch ? (
                  <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">未找到相关图标，请尝试其他关键词</div>
                ) : (
                  <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">输入关键词搜索图标</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
