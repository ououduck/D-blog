import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, RefreshCw, Type, Image as ImageIcon, Palette,
  Sparkles, Upload, X, Search, Copy, Check, Layout, Shuffle,
  ChevronDown, ChevronUp, Frame, SplitSquareHorizontal, AlignLeft, AlignCenter, AlignRight, Wand2, ArrowLeftRight, RotateCcw
} from 'lucide-react';
import { Seo } from '../components/Seo';
import { coverTemplates as templates, type CoverTemplate, type PatternType } from '../config/coverTemplates';

interface ExportRatio {
  label: string;
  w: number;
  h: number;
  active: boolean;
}

interface ShadowConfig {
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
}

type IconPosition = 'center' | 'above' | 'below';
type TextAlign = 'left' | 'center' | 'right';
type LayoutMode = 'icon-split' | 'stacked' | 'icon-only' | 'text-only';

const DEFAULT_TEXT_SHADOW: ShadowConfig = {
  x: 2, y: 2, blur: 8, color: '#000000', opacity: 0.3
};

export const CoverGenerator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // 基础文本状态
  const [leftText, setLeftText] = useState('D-blog');
  const [rightText, setRightText] = useState('跑路的duck');
  const [subText, setSubText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CoverTemplate>(templates[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  // 排版布局
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('icon-split');
  const [iconPosition, setIconPosition] = useState<IconPosition>('center');
  const [textAlign, setTextAlign] = useState<TextAlign>('center');

  // 背景图片状态
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgImageX, setBgImageX] = useState(0);
  const [bgImageY, setBgImageY] = useState(0);
  const [bgImageScale, setBgImageScale] = useState(1);
  const [bgBlur, setBgBlur] = useState(0);
  const [bgOpacity, setBgOpacity] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 图标状态
  const [showIcon, setShowIcon] = useState(true);
  const [customIcon, setCustomIcon] = useState<string | null>('https://blog.pldduck.com/logo.png');
  const [iconSize, setIconSize] = useState(80);
  const [iconColor, setIconColor] = useState('#ffffff');
  const [iconBorderRadius, setIconBorderRadius] = useState(12);
  const [iconBgEnabled, setIconBgEnabled] = useState(true);

  // Iconify 搜索状态
  const [iconifySearch, setIconifySearch] = useState('');
  const [iconifyResults, setIconifyResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showIconifyModal, setShowIconifyModal] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
  const [exportRatios, setExportRatios] = useState<ExportRatio[]>([
    { label: '16:9', w: 16, h: 9, active: true },
    { label: '1:1', w: 1, h: 1, active: false },
    { label: '4:3', w: 4, h: 3, active: false },
    { label: '21:9', w: 21, h: 9, active: false }
  ]);
  const [exportScale, setExportScale] = useState(1);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [exportFilename, setExportFilename] = useState('cover');
  const [activeTab, setActiveTab] = useState<'content' | 'style' | 'layout' | 'export'>('content');
  const [copied, setCopied] = useState(false);


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

  const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; sectionKey: string; action?: React.ReactNode }> =
    ({ icon, title, sectionKey, action }) => (
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center gap-2 text-left hover:opacity-80"
        >
          {icon}
          <h2 className="font-bold text-ink dark:text-white">{title}</h2>
          {isCollapsed(sectionKey) ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronUp size={14} className="text-zinc-400" />}
        </button>
        {action}
      </div>
    );

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
    setTextAlign('center');
    setLayoutMode(showIcon && customIcon ? 'icon-split' : 'text-only');
    resetBackgroundImageControls();
  }, [customIcon, resetBackgroundImageControls, showIcon]);

  const resetAllSettings = useCallback(() => {
    setLeftText('D-blog');
    setRightText('跑路的duck');
    setSubText('');
    setSelectedTemplate(templates[0]);
    setLayoutMode('icon-split');
    setIconPosition('center');
    setTextAlign('center');
    setBgImage(null);
    resetBackgroundImageControls();
    setShowIcon(true);
    setCustomIcon('https://blog.pldduck.com/logo.png');
    setIconifySearch('');
    setIconifyResults([]);
    setSearchError(null);
    setCustomFont(null);
    setExportRatios([
      { label: '16:9', w: 16, h: 9, active: true },
      { label: '1:1', w: 1, h: 1, active: false },
      { label: '4:3', w: 4, h: 3, active: false },
      { label: '21:9', w: 21, h: 9, active: false }
    ]);
  }, [resetBackgroundImageControls, resetStyleSettings]);

  const activeRatio = exportRatios.find(r => r.active) || exportRatios[0];
  const canvasWidth = 1200;
  const canvasHeight = Math.round(canvasWidth / (activeRatio.w / activeRatio.h));
  const canvasSize = { width: canvasWidth, height: canvasHeight };

  const quickStats = useMemo(() => {
    const textCount = [leftText, rightText, subText].filter(Boolean).join('').length;
    return [
      { label: '模板', value: selectedTemplate.name },
      { label: '布局', value: layoutMode === 'icon-split' ? '分列' : layoutMode === 'stacked' ? '堆叠' : layoutMode === 'text-only' ? '纯文字' : '图标' },
      { label: '元素', value: `${showIcon && customIcon ? '图标' : '文字'} · ${textCount} 字` },
      { label: '导出', value: `${activeRatio.label} · ${exportFormat.toUpperCase()}` },
    ];
  }, [activeRatio.label, customIcon, exportFormat, layoutMode, leftText, rightText, selectedTemplate.name, showIcon, subText]);



  const drawPattern = (ctx: CanvasRenderingContext2D, pattern: PatternType, width: number, height: number) => {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.5;

    switch (pattern) {
      case 'dots':
        for (let x = 0; x < width; x += 40) {
          for (let y = 0; y < height; y += 40) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;

      case 'grid':
        for (let x = 0; x < width; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 0; y < height; y += 50) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
        break;

      case 'waves':
        for (let y = 0; y < height; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x < width; x += 10) {
            ctx.lineTo(x, y + Math.sin(x / 50) * 10);
          }
          ctx.stroke();
        }
        break;

      case 'hexagon': {
        const hexSize = 18;
        const rowHeight = hexSize * Math.sqrt(3);
        const colWidth = hexSize * 1.5;
        for (let row = 0; row < Math.ceil(height / rowHeight) + 1; row++) {
          for (let col = 0; col < Math.ceil(width / colWidth) + 1; col++) {
            const cx = col * colWidth + (row % 2) * (colWidth / 2);
            const cy = row * rowHeight;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i - Math.PI / 6;
              const px = cx + hexSize * Math.cos(angle);
              const py = cy + hexSize * Math.sin(angle);
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
        break;
      }

      case 'triangles': {
        const tSize = 20;
        for (let row = 0; row < Math.ceil(height / (tSize * 0.866)) + 1; row++) {
          for (let col = 0; col < Math.ceil(width / tSize) + 1; col++) {
            const cx = col * tSize;
            const cy = row * tSize * 0.866;
            const flip = (row + col) % 2 === 0;
            ctx.beginPath();
            if (flip) {
              ctx.moveTo(cx, cy + tSize);
              ctx.lineTo(cx + tSize / 2, cy);
              ctx.lineTo(cx + tSize, cy + tSize);
            } else {
              ctx.moveTo(cx, cy);
              ctx.lineTo(cx + tSize / 2, cy + tSize);
              ctx.lineTo(cx + tSize, cy);
            }
            ctx.closePath();
            ctx.stroke();
          }
        }
        break;
      }

      case 'circles': {
        for (let x = 40; x < width; x += 60) {
          for (let y = 40; y < height; y += 60) {
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 14, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        break;
      }

      case 'diagonal':
        for (let i = -height; i < width + height; i += 35) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i - height, height);
          ctx.stroke();
        }
        break;

      default: // solid
        break;
    }
    ctx.restore();
  };

  // ==================== 角标装饰 ====================
  const drawCorners = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const size = Math.min(width, height) * 0.08;
    const margin = 40;
    const lineWidth = 3;

    ctx.save();
    ctx.strokeStyle = cornerColor;
    ctx.fillStyle = cornerColor;
    ctx.globalAlpha = cornerOpacity / 100;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    const corners = [
      { x: margin, y: margin, dx: 1, dy: 1 },
      { x: width - margin, y: margin, dx: -1, dy: 1 },
      { x: margin, y: height - margin, dx: 1, dy: -1 },
      { x: width - margin, y: height - margin, dx: -1, dy: -1 },
    ];

    for (const c of corners) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + size * c.dy);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(c.x + size * c.dx, c.y);
      ctx.stroke();

      // 小圆角装饰点
      ctx.beginPath();
      ctx.arc(c.x + size * 0.25 * c.dx, c.y + size * 0.25 * c.dy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // ==================== 分隔线 ====================
  const drawSeparator = (ctx: CanvasRenderingContext2D, width: number, centerY: number) => {
    ctx.save();
    ctx.strokeStyle = separatorColor;
    ctx.globalAlpha = separatorOpacity / 100;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 6]);

    const lineWidth = width * 0.25;
    const startX = (width - lineWidth) / 2;

    ctx.beginPath();
    ctx.moveTo(startX, centerY);
    ctx.lineTo(startX + lineWidth, centerY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  };

  // ==================== 背景图片上传 ====================
  const handleBgImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setBgImage(img);
        setBgImageScale(1);
        setBgImageX(0);
        setBgImageY(0);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleIconUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomIcon(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // ==================== Iconify 搜索 ====================
  const searchIconifyRef = useRef(async (query: string) => {
    if (!query.trim()) { setIconifyResults([]); setSearchError(null); return; }
    if (!navigator.onLine) { setSearchError('网络未连接，请检查网络设置'); setIconifyResults([]); return; }
    setIsSearching(true);
    setSearchError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=24`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        if (response.status === 429) throw new Error('请求过于频繁，请稍后再试');
        if (response.status >= 500) throw new Error('Iconify 服务暂时不可用，请稍后再试');
        throw new Error(`搜索失败 (${response.status})`);
      }
      const data = await response.json();
      if (data.icons && data.icons.length > 0) {
        setIconifyResults(data.icons);
      } else {
        setIconifyResults([]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        setSearchError('网络连接失败，请检查网络后重试');
      } else {
        setSearchError(error.message || '搜索失败，请稍后重试');
      }
      setIconifyResults([]);
    } finally {
      clearTimeout(timeoutId);
      setIsSearching(false);
    }
  });

  // 使用 useMemo 创建稳定防抖函数
  const debouncedSearchIconify = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (query: string) => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        searchIconifyRef.current(query);
        timeoutId = null;
      }, 400);
    };
  }, []);

  const selectIconifyIcon = useCallback((icon: string) => {
    const encodedColor = encodeURIComponent(iconColor);
    const iconUrl = `https://api.iconify.design/${icon}.svg?color=${encodedColor}`;
    setCustomIcon(iconUrl);
    setShowIconifyModal(false);
  }, [iconColor]);

  // ==================== 字体上传 ====================
  const handleFontUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const fontData = event.target?.result as ArrayBuffer;
      const fontFace = new FontFace('CustomFont', fontData);
      await fontFace.load();
      document.fonts.add(fontFace);
      setCustomFont('CustomFont');
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ==================== 画布交互 ====================
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!bgImage) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - bgImageX, y: e.clientY - bgImageY });
  }, [bgImage, bgImageX, bgImageY]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !bgImage) return;
    setBgImageX(e.clientX - dragStart.x);
    setBgImageY(e.clientY - dragStart.y);
  }, [isDragging, bgImage, dragStart]);

  const handleCanvasMouseUp = useCallback(() => setIsDragging(false), []);
  const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!bgImage) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setBgImageScale(prev => Math.max(0.1, Math.min(prev * delta, 10)));
  }, [bgImage]);

  // ==================== 核心渲染 ====================
  const generateCover = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsGenerating(true);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasSize.width;
    tempCanvas.height = canvasSize.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // 绘制背景图片
    if (bgImage) {
      tempCtx.save();
      if (bgBlur > 0) tempCtx.filter = `blur(${bgBlur}px)`;
      tempCtx.globalAlpha = bgOpacity / 100;
      const scale = bgImageScale;
      const x = bgImageX + canvasSize.width / 2;
      const y = bgImageY + canvasSize.height / 2;
      tempCtx.translate(x, y);
      tempCtx.scale(scale, scale);
      tempCtx.drawImage(bgImage, -bgImage.width / 2, -bgImage.height / 2);
      tempCtx.restore();
    }

    // 绘制渐变背景
    tempCtx.globalAlpha = bgImage ? 0.8 : 1;
    const gradientMatch = selectedTemplate.gradient.match(/linear-gradient\((\d+)deg,\s*([^,]+)\s+(\d+)%,\s*([^)]+)\s+(\d+)%\)/);
    if (gradientMatch) {
      const angle = parseInt(gradientMatch[1]);
      const color1 = gradientMatch[2].trim();
      const color2 = gradientMatch[4].trim();
      const angleRad = (angle - 90) * Math.PI / 180;
      const x1 = canvasSize.width / 2 + Math.cos(angleRad) * canvasSize.width / 2;
      const y1 = canvasSize.height / 2 + Math.sin(angleRad) * canvasSize.height / 2;
      const x2 = canvasSize.width / 2 - Math.cos(angleRad) * canvasSize.width / 2;
      const y2 = canvasSize.height / 2 - Math.sin(angleRad) * canvasSize.height / 2;
      const gradient = tempCtx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, color1);
      gradient.addColorStop(1, color2);
      tempCtx.fillStyle = gradient;
    } else {
      // 兼容多色阶渐变
      try {
        const multiMatch = selectedTemplate.gradient.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);
        if (multiMatch) {
          const angle = parseInt(multiMatch[1]);
          const stopsStr = multiMatch[2];
          const stopsRegex = /(#[a-fA-F0-9]{3,6}|rgba?\([^)]+\))\s+(\d+)%/g;
          const stops: { color: string; pos: number }[] = [];
          let m;
          while ((m = stopsRegex.exec(stopsStr)) !== null) {
            stops.push({ color: m[1].trim(), pos: parseInt(m[2]) / 100 });
          }
          if (stops.length >= 2) {
            const angleRad = (angle - 90) * Math.PI / 180;
            const x1 = canvasSize.width / 2 + Math.cos(angleRad) * canvasSize.width / 2;
            const y1 = canvasSize.height / 2 + Math.sin(angleRad) * canvasSize.height / 2;
            const x2 = canvasSize.width / 2 - Math.cos(angleRad) * canvasSize.width / 2;
            const y2 = canvasSize.height / 2 - Math.sin(angleRad) * canvasSize.height / 2;
            const gradient = tempCtx.createLinearGradient(x1, y1, x2, y2);
            stops.forEach(s => gradient.addColorStop(s.pos, s.color));
            tempCtx.fillStyle = gradient;
          } else {
            tempCtx.fillStyle = '#667eea';
          }
        } else {
          tempCtx.fillStyle = '#667eea';
        }
      } catch {
        tempCtx.fillStyle = '#667eea';
      }
    }

    tempCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    tempCtx.globalAlpha = 1;

    // 绘制模糊遮罩层
    if (overlayEnabled) {
      tempCtx.save();
      tempCtx.filter = `blur(${overlayBlur}px)`;
      const r = parseInt(overlayColor.slice(1, 3), 16);
      const g = parseInt(overlayColor.slice(3, 5), 16);
      const b = parseInt(overlayColor.slice(5, 7), 16);
      tempCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${overlayOpacity / 100})`;
      tempCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      tempCtx.restore();
    }

    // 绘制图案
    if (selectedTemplate.pattern !== 'solid') {
      drawPattern(tempCtx, selectedTemplate.pattern, canvasSize.width, canvasSize.height);
    }

    // 绘制角标装饰
    if (showCorners) {
      drawCorners(tempCtx, canvasSize.width, canvasSize.height);
    }

    // 绘制图标和文字
    const drawIconAndText = async () => {
      const fontFamily = customFont || '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
      tempCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

      const centerX = canvasSize.width / 2;
      const centerY = canvasSize.height / 2;

      // 计算文字颜色
      let finalTextColor = textColor;
      if (autoTextColor) {
        finalTextColor = selectedTemplate.id === 'white' ? '#1a1a2e' : '#ffffff';
      }

      // 阴影描边绘制函数
      const applyTextEffects = (ctx2d: CanvasRenderingContext2D) => {
        if (textShadow.opacity > 0) {
          ctx2d.shadowColor = `${textShadow.color}${Math.round(textShadow.opacity * 255).toString(16).padStart(2, '0')}`;
          ctx2d.shadowBlur = textShadow.blur;
          ctx2d.shadowOffsetX = textShadow.x;
          ctx2d.shadowOffsetY = textShadow.y;
        }
      };

      const clearTextEffects = (ctx2d: CanvasRenderingContext2D) => {
        ctx2d.shadowColor = 'transparent';
        ctx2d.shadowBlur = 0;
        ctx2d.shadowOffsetX = 0;
        ctx2d.shadowOffsetY = 0;
      };

      const drawTextWithStroke = (ctx2d: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign) => {
        ctx2d.textAlign = align;
        ctx2d.textBaseline = 'middle';
        applyTextEffects(ctx2d);

        if (textStroke.enabled && textStroke.width > 0) {
          ctx2d.strokeStyle = textStroke.color;
          ctx2d.lineWidth = textStroke.width;
          ctx2d.lineJoin = 'round';
          ctx2d.miterLimit = 2;
          ctx2d.strokeText(text, x, y);
        }

        ctx2d.fillStyle = finalTextColor;
        ctx2d.fillText(text, x, y);
        clearTextEffects(ctx2d);
      };

      // 图标绘制
      let iconCenterX = centerX;
      let iconCenterY = centerY;

      const effectiveLayout = layoutMode === 'icon-split' && showIcon && customIcon ? 'icon-split' :
        layoutMode === 'stacked' ? 'stacked' :
        layoutMode === 'icon-only' ? 'icon-only' :
        layoutMode === 'text-only' ? 'text-only' :
        showIcon && customIcon ? 'icon-split' : 'text-only';

      if (effectiveLayout === 'stacked') {
        iconCenterY = centerY - iconSize / 2 - subSpacing - fontSize / 2;
      } else if (effectiveLayout === 'icon-only') {
        iconCenterY = centerY;
      }

      // 绘制图标
      if ((effectiveLayout === 'icon-split' || effectiveLayout === 'stacked' || effectiveLayout === 'icon-only') && customIcon) {
        const iconX = iconCenterX - iconSize / 2;
        const iconY = iconCenterY - iconSize / 2;
        const iconSrc = customIcon;

        if (iconSrc) {
          const iconImg = new Image();
          iconImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve) => {
            iconImg.onload = () => {
              if (iconBgEnabled) {
                tempCtx.save();
                tempCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                tempCtx.beginPath();
                if (iconBorderRadius > 0) {
                  const radius = (iconSize * iconBorderRadius) / 100;
                  tempCtx.roundRect(iconX, iconY, iconSize, iconSize, radius);
                } else {
                  tempCtx.rect(iconX, iconY, iconSize, iconSize);
                }
                tempCtx.fill();
                tempCtx.restore();
              }
              tempCtx.save();
              if (iconBorderRadius > 0) {
                const radius = (iconSize * iconBorderRadius) / 100;
                tempCtx.beginPath();
                tempCtx.roundRect(iconX, iconY, iconSize, iconSize, radius);
                tempCtx.clip();
              }
              tempCtx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
              tempCtx.restore();
              resolve();
            };
            iconImg.onerror = () => resolve();
            iconImg.src = iconSrc;
          });
        }
      }

      // 绘制分隔线（stacked 模式下，图标和文字之间）
      if (showSeparator && effectiveLayout === 'stacked') {
        drawSeparator(tempCtx, canvasSize.width, iconCenterY + iconSize / 2 + subSpacing / 2);
      }

      // 绘制文字
      if (effectiveLayout === 'icon-split') {
        // 图标在中间，文字分两侧
        const iconX = iconCenterX - iconSize / 2;
        if (leftText) drawTextWithStroke(tempCtx, leftText, iconX - spacing, centerY, 'right');
        if (rightText) drawTextWithStroke(tempCtx, rightText, iconX + iconSize + spacing, centerY, 'left');
        // 副标题在下方
        if (subText) {
          tempCtx.font = `${fontWeight - 200} ${subFontSize}px ${fontFamily}`;
          drawTextWithStroke(tempCtx, subText, centerX, centerY + fontSize / 2 + subSpacing + subFontSize / 2, 'center');
        }
      } else if (effectiveLayout === 'stacked') {
        // 图标在上，文字在下
        const textY = iconCenterY + iconSize / 2 + subSpacing + fontSize / 2;
        const combinedText = leftText && rightText ? `${leftText} ${rightText}` : leftText || rightText;
        if (combinedText && effectiveLayout !== 'icon-only') {
          const alignX = textAlign === 'left' ? 80 : textAlign === 'right' ? canvasSize.width - 80 : centerX;
          const canvasAlign = textAlign === 'left' ? 'left' as const : textAlign === 'right' ? 'right' as const : 'center' as const;
          drawTextWithStroke(tempCtx, combinedText, alignX, textY, canvasAlign);
        }
        if (subText) {
          tempCtx.font = `${fontWeight - 200} ${subFontSize}px ${fontFamily}`;
          const subAlignX = textAlign === 'left' ? 80 : textAlign === 'right' ? canvasSize.width - 80 : centerX;
          const subCanvasAlign = textAlign === 'left' ? 'left' as const : textAlign === 'right' ? 'right' as const : 'center' as const;
          drawTextWithStroke(tempCtx, subText, subAlignX, textY + fontSize / 2 + subSpacing, subCanvasAlign);
        }
      } else {
        // text-only 居中显示
        const combinedText = leftText && rightText ? `${leftText} ${rightText}` : leftText || rightText;
        const alignX = textAlign === 'left' ? 80 : textAlign === 'right' ? canvasSize.width - 80 : centerX;
        const canvasAlign = textAlign === 'left' ? 'left' as const : textAlign === 'right' ? 'right' as const : 'center' as const;
        if (combinedText) {
          const textY = subText ? centerY - subSpacing / 2 - subFontSize / 2 : centerY;
          drawTextWithStroke(tempCtx, combinedText, alignX, textY, canvasAlign);
        }
        if (subText) {
          tempCtx.font = `${fontWeight - 200} ${subFontSize}px ${fontFamily}`;
          const subY = combinedText ? centerY + fontSize / 2 + subSpacing : centerY;
          drawTextWithStroke(tempCtx, subText, alignX, subY, canvasAlign);
        }
      }

      // 将临时canvas绘制到主canvas
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.drawImage(tempCanvas, 0, 0);
      setTimeout(() => setIsGenerating(false), 300);
    };

    await drawIconAndText();
  }, [
    leftText, rightText, subText, selectedTemplate, bgImage, bgImageX, bgImageY,
    bgImageScale, bgBlur, bgOpacity, overlayEnabled, overlayBlur, overlayOpacity, overlayColor,
    showIcon, customIcon, iconSize, iconBorderRadius, iconBgEnabled,
    textShadow, textStroke, customFont, fontWeight, fontSize, subFontSize,
    textColor, spacing, subSpacing, autoTextColor, canvasSize,
    layoutMode, iconPosition, textAlign,     showCorners, cornerColor, cornerOpacity,
    showSeparator, separatorColor, separatorOpacity
  ]);

  // ==================== 导出 ====================
  const downloadCover = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = Math.round(canvasSize.width * exportScale);
    outputCanvas.height = Math.round(canvasSize.height * exportScale);
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) return;

    outputCtx.imageSmoothingEnabled = true;
    outputCtx.imageSmoothingQuality = 'high';
    outputCtx.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height);

    const mimeType = exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = exportFormat === 'jpeg' ? 'jpg' : 'png';

    outputCanvas.toBlob((blob) => {
      if (!blob) { alert('生成图片失败，请重试'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = exportFilename.trim() || 'cover';
      const scaleText = exportScale > 1 ? `@${exportScale}x` : '';
      link.download = `${filename}${scaleText}.${ext}`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    }, mimeType, exportFormat === 'jpeg' ? 0.92 : undefined);
  }, [canvasSize.height, canvasSize.width, exportFilename, exportFormat, exportScale]);

  const copyToClipboard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) { alert('生成图片失败'); return; }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('复制到剪贴板失败，请尝试直接下载');
    }
  }, []);

  // ==================== 随机风格 ====================
  const randomizeStyle = useCallback(() => {
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    setSelectedTemplate(randomTemplate);

    const fontSizes = [48, 56, 64, 72, 80, 96];
    const weights = [300, 400, 500, 600, 700, 800, 900];
    const iconSizes = [48, 56, 64, 72, 80, 96, 120];
    const spacings = [16, 24, 32, 40, 48, 60];
    const radii = [0, 4, 8, 12, 16, 24, 50];
    const layouts: LayoutMode[] = showIcon && customIcon ? ['icon-split', 'stacked', 'text-only'] : ['stacked', 'text-only'];

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
  const inputClass = "w-full rounded-xl border border-zinc-200/80 bg-white/90 px-4 py-2.5 text-ink shadow-sm outline-none transition-all focus:border-ink focus:ring-4 focus:ring-ink/10 dark:border-zinc-700/80 dark:bg-zinc-800/90 dark:text-white dark:focus:border-white dark:focus:ring-white/10";
  const rangeClass = "w-full accent-ink dark:accent-white";
  const colorClass = "h-11 w-full cursor-pointer rounded-xl border border-zinc-200 dark:border-zinc-700";
  const cardClass = "overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-sm transition-all dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-none";
  const dashedBtnClass = "flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700 transition-all hover:border-ink hover:bg-ink/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white dark:hover:bg-white/5";
  const chipClass = "inline-flex items-center rounded-full border border-zinc-200 bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300";

  return (
    <div className="pb-20">
      <Seo title="封面生成" description="在线生成精美博客文章封面图片，支持自定义文字、图标、渐变背景与多种导出比例。" />

      <div className="mb-8 rounded-[2rem] border border-zinc-200/70 bg-gradient-to-br from-zinc-50 via-white to-zinc-100/70 px-6 py-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.05)] dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 md:px-10 md:py-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/80 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300">
          <Wand2 size={14} />
          COVER STUDIO
        </div>
        <h1 className="mb-4 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white md:text-6xl">封面生成器</h1>
        <p className="mx-auto max-w-3xl text-base leading-7 text-zinc-500 dark:text-zinc-400 md:text-lg">
          聚焦博客封面生成体验，保留现有的 <strong>纯黑</strong> 与 <strong>纯白</strong> 两种背景模板，补足更顺手的编辑、预览与导出能力。
        </p>
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-2 rounded-2xl border border-zinc-200/70 bg-white/75 p-2 shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/75">
        {(['content', 'style', 'layout', 'export'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-ink text-white shadow-lg shadow-ink/20 dark:bg-white dark:text-ink dark:shadow-white/20'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
            }`}
          >
            {{ content: '内容', style: '样式', layout: '排版', export: '导出' }[tab]}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {activeTab === 'content' && (
            <>
              <div className={cardClass}>
                <div className="p-5 md:p-6">
                  <SectionHeader
                    icon={<Type size={18} className="text-ink dark:text-white" />}
                    title="文字内容"
                    sectionKey="text-content"
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
                    sectionKey="icon"
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
                        <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
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
                    sectionKey="templates"
                    action={
                      <motion.button
                        whileHover={{ scale: 1.08, rotate: 8 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={randomizeStyle}
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-ink dark:hover:bg-zinc-800 dark:hover:text-white"
                        title="随机风格"
                      >
                        <Shuffle size={16} />
                      </motion.button>
                    }
                  />
                  {!isCollapsed('templates') && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {templates.map((template) => (
                          <motion.button
                            key={template.id}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedTemplate(template)}
                            className={`group relative h-28 overflow-hidden rounded-2xl border transition-all ${
                              selectedTemplate.id === template.id
                                ? 'border-ink shadow-lg shadow-ink/15 ring-4 ring-ink/10 dark:border-white dark:shadow-white/10 dark:ring-white/10'
                                : 'border-zinc-200/80 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
                            }`}
                            style={{ background: template.gradient }}
                            title={template.description || template.name}
                          >
                            <div className={`absolute inset-0 ${template.id === 'white' ? 'bg-gradient-to-br from-black/0 via-black/0 to-black/5' : 'bg-gradient-to-br from-white/5 via-transparent to-white/10'}`} />
                            <div className="absolute inset-x-0 bottom-0 p-4 text-left">
                              <div className={`text-base font-bold ${template.id === 'white' ? 'text-ink' : 'text-white'}`}>{template.name}</div>
                              <div className={`mt-1 text-xs ${template.id === 'white' ? 'text-zinc-600' : 'text-white/70'}`}>{template.description}</div>
                            </div>
                            {selectedTemplate.id === template.id && (
                              <div className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-1 text-[11px] font-bold text-ink shadow-sm dark:bg-zinc-800/80 dark:text-white">当前</div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                        <p className="mb-3 text-xs leading-6 text-zinc-500 dark:text-zinc-400">背景模板固定保留现有两种：<strong>纯黑</strong> 与 <strong>纯白</strong>。你仍可叠加自定义背景图片增强表现。</p>
                        <input ref={bgImageInputRef} type="file" accept="image/*" onChange={handleBgImageUpload} className="hidden" />
                        <button onClick={() => bgImageInputRef.current?.click()} className={dashedBtnClass + ' w-full'}>
                          <Upload size={14} />上传自定义背景图片
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'style' && (
            <>
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
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
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
                  <SectionHeader icon={<Type size={18} className="text-ink dark:text-white" />} title="文字样式" sectionKey="text-style" />
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
                    sectionKey="stroke"
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
                  <SectionHeader icon={<Type size={18} className="text-ink dark:text-white" />} title="文字阴影" sectionKey="shadow" />
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
                    <SectionHeader icon={<ImageIcon size={18} className="text-ink dark:text-white" />} title="图标样式" sectionKey="icon-style" />
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
                    sectionKey="overlay"
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
                    <SectionHeader icon={<ImageIcon size={18} className="text-ink dark:text-white" />} title="背景图片" sectionKey="bg-image" />
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
            </>
          )}

          {/* ===== 排版标签页 ===== */}
          {activeTab === 'layout' && (
            <>
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
                      { mode: 'text-only' as LayoutMode, icon: Type, label: '纯文字', desc: '仅显示文字内容' },
                    ]).map(({ mode, icon: Icon, label, desc }) => (
                      <motion.button
                        key={mode}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
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
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
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
            </>
          )}




          {/* ===== 导出标签页 ===== */}
          {activeTab === 'export' && (
            <>
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
                        {exportRatios.map((ratio) => (
                          <button
                            key={ratio.label}
                            onClick={() => setExportRatios(exportRatios.map(r => ({ ...r, active: r.label === ratio.label })))}
                            className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all ${
                              ratio.active
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
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generateCover}
                  disabled={isGenerating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 font-semibold text-ink transition-all hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                >
                  <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
                  重新生成
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={downloadCover}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-ink to-zinc-800 px-4 py-3 font-semibold text-white shadow-lg shadow-ink/25 transition-all hover:shadow-xl hover:shadow-ink/30 dark:from-white dark:to-zinc-200 dark:text-ink dark:shadow-white/25 dark:hover:shadow-white/30"
                >
                  <Download size={18} />
                  下载封面
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={copyToClipboard}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 font-semibold transition-all ${
                    copied
                      ? 'border-green-500 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      : 'border-zinc-200 text-zinc-600 hover:border-ink dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-white'
                  }`}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? '已复制' : '复制到剪贴板'}
                </motion.button>

                <button onClick={resetAllSettings} className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-500 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-red-500/40 dark:hover:bg-red-900/10 dark:hover:text-red-400">
                  <RotateCcw size={16} />重置全部设置
                </button>
              </div>
            </>
          )}
        </div>

        {/* 右侧预览区域 */}
        <div className="lg:col-span-2">
          <div className="sticky top-24 rounded-[2rem] border border-zinc-200/70 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-900/90 md:p-6">
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
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={randomizeStyle} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
                <Shuffle size={16} />随机样式
              </motion.button>
              <button onClick={generateCover} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
                <RefreshCw size={16} className={isGenerating ? 'animate-spin' : ''} />刷新预览
              </button>
              {bgImage && (
                <button onClick={resetBackgroundImageControls} className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
                  <RotateCcw size={16} />重置背景位置
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.7),rgba(244,244,245,0.9))] p-3 dark:border-zinc-700 dark:bg-[radial-gradient(circle_at_top,rgba(39,39,42,0.8),rgba(24,24,27,0.95))] md:p-4">
              <div className="overflow-hidden rounded-[1.15rem] border border-zinc-200/70 bg-zinc-50 shadow-inner dark:border-zinc-700 dark:bg-zinc-800">
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  className={`w-full ${bgImage ? 'cursor-move' : 'cursor-default'}`}
                  style={{ aspectRatio: `${activeRatio.w}/${activeRatio.h}` }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  onWheel={handleCanvasWheel}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/80">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">当前模板</div>
                <div className="mt-2 text-lg font-bold text-ink dark:text-white">{selectedTemplate.name}</div>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">只保留现有黑白模板，避免风格面板过度分散。</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/80">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">预览提示</div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{bgImage ? '已启用背景图：可拖拽移动，滚轮缩放。' : '当前为纯模板预览：上传背景图可增加层次感。'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-800/80">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">导出结果</div>
                <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">文件将以 <strong>{exportFilename.trim() || 'cover'}</strong> 导出，格式为 <strong>{exportFormat.toUpperCase()}</strong>。</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 shrink-0 text-ink dark:text-white" size={16} />
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <p className="font-semibold">使用提示：</p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-6">
                    <li>- <strong>内容</strong>：编辑主标题、副标题、图标与黑白模板。</li>
                    <li>- <strong>样式</strong>：调节字体、颜色、阴影、描边，并支持一键重置样式。</li>
                    <li>- <strong>排版</strong>：切换布局模式、文字对齐与装饰元素。</li>
                    <li>- <strong>导出</strong>：支持比例、格式、倍率与文件名配置，倍率现在会真正影响下载尺寸。</li>
                    <li>- 上传背景图片后可拖拽移动、滚轮缩放，并用“重置背景位置”快速归位。</li>
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
            onClick={() => setShowIconifyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-ink dark:text-white">搜索 Iconify 图标</h2>
                <button onClick={() => setShowIconifyModal(false)} className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
                  <X size={20} />
                </button>
              </div>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text" value={iconifySearch}
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
                  <div className="grid grid-cols-6 gap-3">
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
