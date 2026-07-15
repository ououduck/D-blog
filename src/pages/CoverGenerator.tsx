import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, RefreshCw, Type, Image as ImageIcon, Palette,
  Sparkles, Upload, X, Search, Copy, Check, Layout, Shuffle,
  ChevronDown, ChevronUp, Frame, SplitSquareHorizontal, AlignLeft, AlignCenter, AlignRight, Wand2, ArrowLeftRight, RotateCcw
} from 'lucide-react';
import { Seo } from '../components/Seo';
import { useModalOverlay } from '../hooks/useModalOverlay';
import { coverTemplates as templates, defaultTemplate, type CoverTemplate } from '../config/coverTemplates';
import { COVER_RATIOS, DEFAULT_TEXT_SHADOW } from './cover/coverConstants';
import { getCanvasSize, getExportFilename } from './cover/coverLayout';
import { loadFontFile, loadImageFile } from './cover/coverFiles';
import { renderCover } from './cover/coverRenderer';
import type { LayoutMode, ShadowConfig, TextAlign } from './cover/coverTypes';

const DEFAULT_ICON_SOURCE = '/logo.png';

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
    <button type="button" onClick={() => onToggle(sectionKey)} aria-expanded={!collapsed} className="flex items-center gap-2 text-left hover:opacity-80">
      {icon}
      <h2 className="font-bold text-ink dark:text-white">{title}</h2>
      {collapsed ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronUp size={14} className="text-zinc-400" />}
    </button>
    {action}
  </div>
);

export const CoverGenerator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const iconSearchInputRef = useRef<HTMLInputElement>(null);
  const renderIdRef = useRef(0);

  // 基础文本状态
  const [leftText, setLeftText] = useState('D-blog');
  const [rightText, setRightText] = useState('跑路的duck');
  const [subText, setSubText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CoverTemplate>(defaultTemplate);
  const [isGenerating, setIsGenerating] = useState(false);

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
  const [isDragging, setIsDragging] = useState(false);
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

  const closeIconifyModal = useCallback(() => setShowIconifyModal(false), []);
  useModalOverlay({
    isOpen: showIconifyModal,
    onClose: closeIconifyModal,
    initialFocusRef: iconSearchInputRef
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
    setBgImage(null);
    resetBackgroundImageControls();
    setShowIcon(true);
    setCustomIcon(DEFAULT_ICON_SOURCE);
    setIconifyIconName(null);
    setIconifySearch('');
    setIconifyResults([]);
    setSearchError(null);
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



  // ==================== 背景图片上传 ====================
  const handleBgImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    try {
      const file = input.files?.[0];
      if (!file) return;
      const image = await loadImageFile(file, 'background');
      setBgImage(image);
      setBgImageScale(1);
      setBgImageX(0);
      setBgImageY(0);
      setFeedback({ kind: 'success', message: '背景图片已加载' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '背景图片加载失败' });
    } finally {
      input.value = '';
    }
  }, [canvasSize]);

  const handleIconUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    try {
      const file = input.files?.[0];
      if (!file) return;
      const image = await loadImageFile(file, 'icon');
      setCustomIcon(image.src);
      setIconifyIconName(null);
      setFeedback({ kind: 'success', message: '图标已加载' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '图标加载失败' });
    } finally {
      input.value = '';
    }
  }, []);

  // ==================== Iconify 搜索 ====================
  const iconifyDebounceRef = useRef<number | null>(null);
  const searchIconify = useCallback(async (query: string) => {
    const normalizedQuery = query.trim();
    iconifyAbortRef.current?.abort();
    if (!normalizedQuery) {
      setIconifyResults([]);
      setSearchError(null);
      setIsSearching(false);
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
      if (requestId === iconifySearchIdRef.current) setIconifyResults(data.icons ?? []);
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
    } finally {
      window.clearTimeout(timeoutId);
      if (requestId === iconifySearchIdRef.current) setIsSearching(false);
    }
  }, []);

  const debouncedSearchIconify = useCallback((query: string) => {
    if (iconifyDebounceRef.current) window.clearTimeout(iconifyDebounceRef.current);
    iconifyDebounceRef.current = window.setTimeout(() => searchIconify(query), 400);
  }, [searchIconify]);

  useEffect(() => () => {
    if (iconifyDebounceRef.current) window.clearTimeout(iconifyDebounceRef.current);
    iconifyAbortRef.current?.abort();
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

  // ==================== 字体上传 ====================
  const handleFontUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    try {
      const file = input.files?.[0];
      if (!file) return;
      const fontFace = await loadFontFile(file);
      document.fonts.add(fontFace);
      setCustomFont(fontFace.family);
      setFeedback({ kind: 'success', message: '自定义字体已加载' });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '字体加载失败' });
    } finally {
      input.value = '';
    }
  }, []);

  // ==================== 画布交互 ====================
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
    setBgImageX(dragStateRef.current.imageX + (e.clientX - dragStateRef.current.startX) * canvasSize.width / rect.width);
    setBgImageY(dragStateRef.current.imageY + (e.clientY - dragStateRef.current.startY) * canvasSize.height / rect.height);
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
    setBgImageScale(prev => Math.max(0.1, Math.min(prev * delta, 10)));
  }, [bgImage]);

  // ==================== 核心渲染 ====================
  const generateCover = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const renderId = ++renderIdRef.current;
    setIsGenerating(true);
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasSize.width;
      tempCanvas.height = canvasSize.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('浏览器无法创建封面画布');

      await renderCover(tempCtx, {
        size: canvasSize,
        template: selectedTemplate,
        layout: layoutMode,
        textAlign,
        leftText,
        rightText,
        subText,
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
        backgroundImage: bgImage ? {
          image: bgImage,
          x: bgImageX,
          y: bgImageY,
          scale: bgImageScale,
          blur: bgBlur,
          opacity: bgOpacity
        } : null,
        overlay: {
          enabled: overlayEnabled,
          blur: overlayBlur,
          opacity: overlayOpacity,
          color: overlayColor
        },
        icon: {
          show: showIcon,
          source: customIcon,
          size: iconSize,
          borderRadius: iconBorderRadius,
          backgroundEnabled: iconBgEnabled
        },
        decorations: {
          showCorners,
          cornerColor,
          cornerOpacity,
          showSeparator,
          separatorColor,
          separatorOpacity
        },
        maxTextLines: 2,
        minFontSize: 18
      });

      if (renderId !== renderIdRef.current) return;
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.drawImage(tempCanvas, 0, 0);
      setFeedback(current => current?.kind === 'error' ? null : current);
    } catch (error) {
      if (renderId === renderIdRef.current) {
        setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '封面生成失败' });
      }
    } finally {
      if (renderId === renderIdRef.current) setIsGenerating(false);
    }
  }, [
    autoTextColor, bgBlur, bgImage, bgImageScale, bgImageX, bgImageY, bgOpacity,
    canvasSize, cornerColor, cornerOpacity, customFont, customIcon, fontSize, fontWeight,
    iconBgEnabled, iconBorderRadius, iconSize, layoutMode, leftText, overlayBlur,
    overlayColor, overlayEnabled, overlayOpacity, rightText, selectedTemplate,
    separatorColor, separatorOpacity, showCorners, showIcon, showSeparator, spacing,
    subFontSize, subSpacing, subText, textAlign, textColor, textShadow, textStroke
  ]);

  // ==================== 导出 ====================
  const canvasToBlob = useCallback((canvas: HTMLCanvasElement, type: string, quality?: number) => (
    new Promise<Blob>((resolve, reject) => {
      try {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片编码失败，请重试')), type, quality);
      } catch {
        reject(new Error('素材跨域限制导致无法导出，请更换图标或图片'));
      }
    })
  ), []);

  const downloadCover = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || isGenerating) return;
    try {
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = Math.round(canvasSize.width * exportScale);
      outputCanvas.height = Math.round(canvasSize.height * exportScale);
      const outputCtx = outputCanvas.getContext('2d');
      if (!outputCtx) throw new Error('浏览器无法创建导出画布');
      outputCtx.imageSmoothingEnabled = true;
      outputCtx.imageSmoothingQuality = 'high';
      outputCtx.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height);

      const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await canvasToBlob(outputCanvas, mimeType, exportFormat === 'jpeg' ? 0.92 : undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = getExportFilename(exportFilename, exportFormat, exportScale);
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 100);
      setFeedback({ kind: 'success', message: `封面已导出为 ${link.download}` });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '下载封面失败' });
    }
  }, [canvasSize.height, canvasSize.width, canvasToBlob, exportFilename, exportFormat, exportScale, isGenerating]);

  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || isGenerating) return;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('当前浏览器不支持复制图片，请直接下载');
      }
      const blob = await canvasToBlob(canvas, 'image/png');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setFeedback({ kind: 'success', message: '封面已复制到剪贴板' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : '复制失败，请直接下载' });
    }
  }, [canvasToBlob, isGenerating]);

  // ==================== 随机风格 ====================
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

  // ==================== UI 渲染 ====================
  const inputClass = "w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-ink outline-none transition-colors focus:border-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white";
  const rangeClass = "w-full accent-ink dark:accent-white";
  const colorClass = "h-11 w-full cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700";
  const cardClass = "overflow-hidden rounded-xl border border-zinc-200 bg-white transition-colors dark:border-zinc-800 dark:bg-zinc-900";
  const dashedBtnClass = "flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:bg-ink/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-white/5";
  const chipClass = "inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

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
            key={tab}
            id={`cover-tab-${tab}`}
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`cover-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={handleTabKeyDown}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
            }`}
          >
            {{ content: '内容', style: '样式', layout: '排版', export: '导出' }[tab]}
          </button>
        ))}
      </div>

      {feedback && (
        <div
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          aria-live={feedback.kind === 'error' ? 'assertive' : 'polite'}
          className={`mb-5 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
              : feedback.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="关闭提示" title="关闭提示" className="shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10">
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
                      <button onClick={swapMainTexts} className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-white" title="交换左右文字">
                        <ArrowLeftRight size={16} />
                      </button>
                    }
                  />
                  {!isCollapsed('text-content') && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">左侧/主要文字</label>
                          <input type="text" value={leftText} onChange={(e) => setLeftText(e.target.value)} className={inputClass} placeholder="主标题" />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">右侧文字</label>
                          <input type="text" value={rightText} onChange={(e) => setRightText(e.target.value)} className={inputClass} placeholder="副标题" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">次要/描述文字</label>
                        <input type="text" value={subText} onChange={(e) => setSubText(e.target.value)} className={inputClass} placeholder="可选描述文字（如：技术博客）" />
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
                        <input type="checkbox" checked={showIcon} onChange={(e) => setShowIcon(e.target.checked)} className="rounded accent-ink dark:accent-white" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">显示</span>
                      </label>
                    }
                  />
                  {!isCollapsed('icon') && showIcon && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setShowIconifyModal(true)} className={dashedBtnClass}>
                          <Search size={14} />搜索图标
                        </button>
                        <input ref={iconInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleIconUpload} className="hidden" />
                        <button onClick={() => iconInputRef.current?.click()} className={dashedBtnClass}>
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
                        onClick={randomizeStyle}
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-white"
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
                            onClick={() => setSelectedTemplate(template)}
                            className={`group relative h-28 overflow-hidden rounded-xl border transition-colors ${
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
                              <div className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-1 text-[11px] font-bold text-ink shadow-sm dark:bg-zinc-800/80 dark:text-white">当前</div>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                        <p className="mb-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">背景模板固定保留现有两种：<strong>纯黑</strong> 与 <strong>纯白</strong>。你仍可叠加自定义背景图片增强表现。</p>
                        <input ref={bgImageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleBgImageUpload} className="hidden" />
                        <button onClick={() => bgImageInputRef.current?.click()} className={dashedBtnClass + ' w-full'}>
                          <Upload size={14} />上传自定义背景图片
                        </button>
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
                    <Sparkles size={18} className="text-accent" />
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
                      <motion.button
                        key={preset.name}
                        onClick={preset.action}
                        className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs font-semibold text-zinc-700 transition-all hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                      >
                        {preset.name}
                      </motion.button>
                    ))}
                  </div>
                  <button onClick={resetStyleSettings} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition-all hover:border-ink hover:text-ink dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
                    <RotateCcw size={14} />重置样式参数
                  </button>
                </div>
              </div>


              {/* 文字样式 */}
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
                        <input type="range" min="24" max="120" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>副标题大小</span>
                          <span className="text-ink dark:text-white tabular-nums">{subFontSize}px</span>
                        </label>
                        <input type="range" min="16" max="48" value={subFontSize} onChange={(e) => setSubFontSize(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>文字间距</span>
                          <span className="text-ink dark:text-white tabular-nums">{spacing}px</span>
                        </label>
                        <input type="range" min="0" max="120" value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>字体粗细</span>
                          <span className="text-ink dark:text-white tabular-nums">{fontWeight}</span>
                        </label>
                        <input type="range" min="100" max="900" step="100" value={fontWeight} onChange={(e) => setFontWeight(Number(e.target.value))} className={rangeClass} />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={autoTextColor} onChange={(e) => setAutoTextColor(e.target.checked)} className="rounded accent-ink dark:accent-white" />
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">自动反色（根据背景）</span>
                      </label>
                      {!autoTextColor && (
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">文字颜色</label>
                          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className={colorClass} />
                        </div>
                      )}
                      <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} className="hidden" />
                      <button onClick={() => fontInputRef.current?.click()} className={dashedBtnClass + ' w-full'}>
                        <Upload size={14} />上传自定义字体
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 文字描边 */}
              <div className={cardClass}>
                <div className="p-5">
                  <SectionHeader
                    icon={<Type size={18} className="text-ink dark:text-white" />}
                    title="文字描边"
                    sectionKey="stroke" collapsed={isCollapsed("stroke")} onToggle={toggleSection}
                    action={
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={textStroke.enabled} onChange={(e) => setTextStroke({ ...textStroke, enabled: e.target.checked })} className="rounded accent-ink dark:accent-white" />
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
                        <input type="range" min="1" max="10" value={textStroke.width} onChange={(e) => setTextStroke({ ...textStroke, width: Number(e.target.value) })} className={rangeClass} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">描边颜色</label>
                        <input type="color" value={textStroke.color} onChange={(e) => setTextStroke({ ...textStroke, color: e.target.value })} className={colorClass} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 文字阴影 */}
              <div className={cardClass}>
                <div className="p-5">
                  <SectionHeader icon={<Type size={18} className="text-ink dark:text-white" />} title="文字阴影" sectionKey="shadow" collapsed={isCollapsed("shadow")} onToggle={toggleSection} />
                  {!isCollapsed('shadow') && (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>透明度</span><span className="tabular-nums">{Math.round(textShadow.opacity * 100)}%</span>
                        </label>
                        <input type="range" min="0" max="1" step="0.1" value={textShadow.opacity} onChange={(e) => setTextShadow({ ...textShadow, opacity: Number(e.target.value) })} className={rangeClass} />
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

              {/* 图标样式 */}
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
                          <input type="checkbox" checked={iconBgEnabled} onChange={(e) => setIconBgEnabled(e.target.checked)} className="rounded accent-ink dark:accent-white" />
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">显示图标背景</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 背景遮罩 */}
              <div className={cardClass}>
                <div className="p-5">
                  <SectionHeader
                    icon={<Palette size={18} className="text-ink dark:text-white" />}
                    title="背景遮罩"
                    sectionKey="overlay" collapsed={isCollapsed("overlay")} onToggle={toggleSection}
                    action={
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={overlayEnabled} onChange={(e) => setOverlayEnabled(e.target.checked)} className="rounded accent-ink dark:accent-white" />
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

              {/* 背景图片控制 */}
              {bgImage && (
                <div className={cardClass}>
                  <div className="p-5">
                    <SectionHeader icon={<ImageIcon size={18} className="text-ink dark:text-white" />} title="背景图片" sectionKey="bg-image" collapsed={isCollapsed("bg-image")} onToggle={toggleSection} />
                    {!isCollapsed('bg-image') && (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>模糊</span><span className="tabular-nums">{bgBlur}px</span>
                          </label>
                          <input type="range" min="0" max="20" value={bgBlur} onChange={(e) => setBgBlur(Number(e.target.value))} className={rangeClass} />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>不透明度</span><span className="tabular-nums">{bgOpacity}%</span>
                          </label>
                          <input type="range" min="0" max="100" value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} className={rangeClass} />
                        </div>
                        <button onClick={() => setBgImage(null)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition-all hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40">
                          <X size={14} />移除背景图片
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== 排版标签页 ===== */}
          {activeTab === 'layout' && (
            <div id="cover-panel-layout" role="tabpanel" aria-labelledby="cover-tab-layout" className="space-y-4">
              {/* 布局模式 */}
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
                      <motion.button
                        key={mode}
                        onClick={() => setLayoutMode(mode)}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                          layoutMode === mode
                            ? 'border-ink bg-ink/5 dark:border-white dark:bg-white/10'
                            : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
                        }`}
                      >
                        <Icon size={22} className={layoutMode === mode ? 'text-ink dark:text-white' : 'text-zinc-400'} />
                        <span className={`text-xs font-semibold ${layoutMode === mode ? 'text-ink dark:text-white' : 'text-zinc-500'}`}>{label}</span>
                        <span className="text-[10px] text-zinc-400 leading-tight text-center">{desc}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 文字对齐 */}
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
                      <motion.button
                        key={align}
                        onClick={() => setTextAlign(align)}
                        className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all ${
                          textAlign === align
                            ? 'border-ink bg-ink/5 dark:border-white dark:bg-white/10'
                            : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
                        }`}
                      >
                        <Icon size={22} className={textAlign === align ? 'text-ink dark:text-white' : 'text-zinc-400'} />
                        <span className={`text-xs font-semibold ${textAlign === align ? 'text-ink dark:text-white' : 'text-zinc-500'}`}>{label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 装饰元素 */}
              <div className={cardClass}>
                <div className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Frame size={18} className="text-ink dark:text-white" />
                    <h2 className="font-bold text-ink dark:text-white">装饰元素</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={showCorners} onChange={(e) => setShowCorners(e.target.checked)} className="rounded accent-ink dark:accent-white" />
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
                        <input type="checkbox" checked={showSeparator} onChange={(e) => setShowSeparator(e.target.checked)} className="rounded accent-ink dark:accent-white" />
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




          {/* ===== 导出标签页 ===== */}
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
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">宽高比</label>
                      <div className="grid grid-cols-4 gap-2">
                        {COVER_RATIOS.map((ratio) => (
                          <button
                            key={ratio.label}
                            onClick={() => setActiveRatioLabel(ratio.label)}
                            className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all ${
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
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">格式</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['png', 'jpeg'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setExportFormat(f)}
                            className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold uppercase transition-all ${
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
                      <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        <span>导出倍率</span>
                        <span className="tabular-nums text-ink dark:text-white">{exportScale}x</span>
                      </label>
                      <input type="range" min="1" max="3" step="0.5" value={exportScale} onChange={(e) => setExportScale(Number(e.target.value))} className={rangeClass} />
                      <p className="mt-1 text-xs text-zinc-400">下载时将输出为 {Math.round(canvasSize.width * exportScale)} × {Math.round(canvasSize.height * exportScale)} px</p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">文件名</label>
                      <input type="text" value={exportFilename} onChange={(e) => setExportFilename(e.target.value)} className={inputClass} placeholder="cover" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <motion.button
                  onClick={generateCover}
                  disabled={isGenerating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2.5 font-semibold text-ink transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                >
                  <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
                  重新生成
                </motion.button>

                <motion.button
                  onClick={downloadCover}
                  disabled={isGenerating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-ink bg-ink px-4 py-2.5 font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-ink dark:hover:bg-zinc-200"
                >
                  <Download size={18} />
                  下载封面
                </motion.button>

                <motion.button
                  onClick={copyToClipboard}
                  disabled={isGenerating}
                  className={`flex flex-1 disabled:cursor-not-allowed disabled:opacity-50 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-semibold transition-colors ${
                    copied
                      ? 'border-green-500 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      : 'border-zinc-200 text-zinc-600 hover:border-ink dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-white'
                  }`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? '已复制' : '复制到剪贴板'}
                </motion.button>

                <button onClick={resetAllSettings} className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-500/40 dark:hover:bg-red-900/10 dark:hover:text-red-400">
                  <RotateCcw size={16} />重置全部设置
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧预览区域 */}
        <div className="order-1 min-w-0 lg:order-2 lg:col-span-2">
          <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:p-5 lg:sticky lg:top-24">
            <div className="mb-4 flex flex-col gap-4 border-b border-zinc-200/70 pb-4 dark:border-zinc-800/80 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ImageIcon className="text-ink dark:text-white" size={20} />
                  <h2 className="font-bold text-ink dark:text-white">实时预览</h2>
                  {isGenerating && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">生成中</span>}
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
              <motion.button onClick={randomizeStyle} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
                <Shuffle size={16} />随机样式
              </motion.button>
              <button onClick={generateCover} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
                <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />刷新预览
              </button>
              {bgImage && (
                <button onClick={resetBackgroundImageControls} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
                  <RotateCcw size={16} />重置背景位置
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-2 dark:border-zinc-700 dark:bg-zinc-800 md:p-3">
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  aria-label={bgImage ? '封面预览，可拖动调整背景图片位置' : '封面预览'}
                  className={`block h-auto max-w-full select-none ${bgImage ? isDragging ? 'cursor-grabbing' : 'cursor-grab' : 'cursor-default'}`}
                  style={{ aspectRatio: `${activeRatio.w}/${activeRatio.h}`, touchAction: bgImage ? 'none' : 'auto' }}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerEnd}
                  onPointerCancel={handleCanvasPointerEnd}
                  onWheel={handleCanvasWheel}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">当前模板</div>
                <div className="mt-2 text-lg font-bold text-ink dark:text-white">{selectedTemplate.name}</div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">只保留现有黑白模板，避免风格面板过度分散。</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">预览提示</div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{bgImage ? '已启用背景图：鼠标或触屏拖动可调整位置，滚轮可缩放。' : '当前为纯模板预览：上传背景图可增加层次感。'}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">导出结果</div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">文件将以 <strong>{exportFilename.trim() || 'cover'}</strong> 导出，格式为 <strong>{exportFormat.toUpperCase()}</strong>。</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
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

      {/* Iconify 搜索弹窗 */}
      <AnimatePresence>
        {showIconifyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={closeIconifyModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="iconify-dialog-title"
              className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="iconify-dialog-title" className="text-xl font-bold text-ink dark:text-white">搜索 Iconify 图标</h2>
                <button type="button" onClick={closeIconifyModal} aria-label="关闭图标搜索" title="关闭" className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    ref={iconSearchInputRef}
                    type="search" value={iconifySearch}
                    onChange={(e) => { setIconifySearch(e.target.value); debouncedSearchIconify(e.target.value); }}
                    placeholder="搜索图标，例如：home, user, settings..."
                    className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-10 pr-4 text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ink/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
                  />
                </div>
                {searchError && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    <X size={16} /><span>{searchError}</span>
                  </motion.div>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-12"><RefreshCw className="animate-spin text-ink dark:text-white" size={32} /></div>
                ) : iconifyResults.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {iconifyResults.map((icon) => (
                      <button key={icon} onClick={() => selectIconifyIcon(icon)}
                        className="flex aspect-square items-center justify-center rounded-lg border-2 border-zinc-200 bg-zinc-50 p-3 transition-all hover:border-ink hover:bg-ink/5 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-white dark:hover:bg-white/5"
                        title={icon}>
                        <img src={`https://api.iconify.design/${icon}.svg`} alt={icon} className="h-full w-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
