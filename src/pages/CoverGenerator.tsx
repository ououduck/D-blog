import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, Type, Image as ImageIcon, Palette, Sparkles, Upload, X, ZoomIn, ZoomOut, Move, Search } from 'lucide-react';
import { Seo } from '../components/Seo';
import { coverTemplates as templates, type CoverTemplate } from '../config/coverTemplates';

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

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  }
};

export const CoverGenerator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  
  // 基础文本状态
  const [leftText, setLeftText] = useState('D-blog');
  const [rightText, setRightText] = useState('跑路的duck');
  const [selectedTemplate, setSelectedTemplate] = useState<CoverTemplate>(templates[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  
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
  
  // 字体状态
  const [customFont, setCustomFont] = useState<string | null>(null);
  const [fontWeight, setFontWeight] = useState(700);
  const [fontSize, setFontSize] = useState(72);
  const [textColor, setTextColor] = useState('#ffffff');
  const [spacing, setSpacing] = useState(32);
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const [colorSync, setColorSync] = useState(false);
  const [autoTextColor, setAutoTextColor] = useState(true); // 自动反色
  
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
  
  // 阴影状态
  const [textShadow, setTextShadow] = useState<ShadowConfig>({
    x: 2,
    y: 2,
    blur: 8,
    color: '#000000',
    opacity: 0.3
  });
  
  // 导出比例
  const [exportRatios, setExportRatios] = useState<ExportRatio[]>([
    { label: '16:9', w: 16, h: 9, active: true },
    { label: '1:1', w: 1, h: 1, active: false },
    { label: '4:3', w: 4, h: 3, active: false },
    { label: '21:9', w: 21, h: 9, active: false }
  ]);
  const [exportScale, setExportScale] = useState(1);
  const [activeTab, setActiveTab] = useState<'content' | 'style' | 'export'>('content');
  const [exportTransparent, setExportTransparent] = useState(false);
  const [exportFilename, setExportFilename] = useState('cover');
  
  const activeRatio = exportRatios.find(r => r.active) || exportRatios[0];
  const canvasWidth = 1200;
  const canvasHeight = Math.round(canvasWidth / (activeRatio.w / activeRatio.h));
  const canvasSize = { width: canvasWidth, height: canvasHeight };

  const drawPattern = (ctx: CanvasRenderingContext2D, pattern: string, width: number, height: number) => {
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

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
    }
    ctx.globalAlpha = 1;
  };

  // 背景图片上传处理
  const handleBgImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // 允许跨域
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

  // 图标上传处理
  const handleIconUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomIcon(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Iconify 搜索处理
  const searchIconify = useCallback(async (query: string) => {
    if (!query.trim()) {
      setIconifyResults([]);
      return;
    }
    
    setIsSearching(true);
    
    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      // 搜索 Iconify 图标
      const response = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=24`, {
        signal: controller.signal
      });
      
      // 检查 HTTP 响应状态
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.icons && data.icons.length > 0) {
        setIconifyResults(data.icons);
      } else {
        setIconifyResults([]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('搜索超时：请求超过 5 秒未响应');
      } else {
        console.error('搜索失败:', error);
      }
      setIconifyResults([]);
    } finally {
      clearTimeout(timeoutId);
      setIsSearching(false);
    }
  }, []);

  // 选择 Iconify 图标
  const selectIconifyIcon = useCallback((icon: string) => {
    // 使用 Iconify API 获取 SVG
    const iconUrl = `https://api.iconify.design/${icon}.svg?color=${encodeURIComponent(iconColor)}`;
    setCustomIcon(iconUrl);
    setShowIconifyModal(false);
  }, [iconColor]);

  // 字体上传处理
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

  // 背景图片拖拽处理
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

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!bgImage) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setBgImageScale(prev => Math.max(0.1, Math.min(prev * delta, 10)));
  }, [bgImage]);

  const generateCover = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGenerating(true);

    // 创建临时canvas用于渐变
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasSize.width;
    tempCanvas.height = canvasSize.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // 绘制背景图片
    if (bgImage) {
      tempCtx.save();
      if (bgBlur > 0) {
        tempCtx.filter = `blur(${bgBlur}px)`;
      }
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
      tempCtx.fillStyle = '#667eea';
    }

    tempCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    tempCtx.globalAlpha = 1;

    // 绘制模糊遮罩层
    if (overlayEnabled) {
      tempCtx.save();
      tempCtx.filter = `blur(${overlayBlur}px)`;
      tempCtx.fillStyle = `rgba(0, 0, 0, ${overlayOpacity / 100})`;
      tempCtx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      tempCtx.restore();
    }

    // 绘制图案
    if (selectedTemplate.pattern !== 'solid') {
      drawPattern(tempCtx, selectedTemplate.pattern, canvasSize.width, canvasSize.height);
    }

    // 绘制装饰元素
    tempCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    tempCtx.beginPath();
    tempCtx.arc(canvasSize.width * 0.8, canvasSize.height * 0.2, 150, 0, Math.PI * 2);
    tempCtx.fill();

    // 绘制图标和文字（图标居中，文字在两侧）
    const drawIconAndText = async () => {
      const fontFamily = customFont || '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      tempCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      
      // 计算文字宽度
      const leftWidth = leftText ? tempCtx.measureText(leftText).width : 0;
      const rightWidth = rightText ? tempCtx.measureText(rightText).width : 0;
      
      // 中心点
      const centerX = canvasSize.width / 2;
      const centerY = canvasSize.height / 2;
      
      // 图标位置（居中）
      const iconX = centerX - iconSize / 2;
      const iconY = centerY - iconSize / 2;
      
      // 绘制图标
      if (showIcon && customIcon) {
        const iconSrc = customIcon;
        
        if (iconSrc) {
          const iconImg = new Image();
          iconImg.crossOrigin = 'anonymous'; // 允许跨域
          await new Promise<void>((resolve) => {
            iconImg.onload = () => {
              // 绘制图标背景
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
              
              // 绘制图标
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
            iconImg.onerror = (e) => {
              console.error('Failed to load icon image:', e);
              resolve();
            };
            iconImg.src = iconSrc;
          });
        }
      }
      
      // 计算文字颜色（自动反色或手动设置）
      let finalTextColor = textColor;
      if (autoTextColor) {
        // 根据背景颜色自动反色
        const bgColor = selectedTemplate.id === 'white' ? '#ffffff' : '#000000';
        finalTextColor = bgColor === '#ffffff' ? '#000000' : '#ffffff';
      } else {
        finalTextColor = colorSync ? iconColor : textColor;
      }

      // 绘制文字函数
      const drawText = (text: string, x: number, align: CanvasTextAlign) => {
        tempCtx.textAlign = align;
        tempCtx.textBaseline = 'middle';
        
        // 应用文字阴影
        if (textShadow.opacity > 0) {
          tempCtx.shadowColor = `${textShadow.color}${Math.round(textShadow.opacity * 255).toString(16).padStart(2, '0')}`;
          tempCtx.shadowBlur = textShadow.blur;
          tempCtx.shadowOffsetX = textShadow.x;
          tempCtx.shadowOffsetY = textShadow.y;
        }
        
        // 绘制描边
        if (textStroke.enabled && textStroke.width > 0) {
          tempCtx.strokeStyle = textStroke.color;
          tempCtx.lineWidth = textStroke.width;
          tempCtx.lineJoin = 'round';
          tempCtx.miterLimit = 2;
          tempCtx.strokeText(text, x, centerY);
        }
        
        // 绘制填充文字
        tempCtx.fillStyle = finalTextColor;
        tempCtx.fillText(text, x, centerY);
        
        // 重置阴影
        tempCtx.shadowColor = 'transparent';
        tempCtx.shadowBlur = 0;
        tempCtx.shadowOffsetX = 0;
        tempCtx.shadowOffsetY = 0;
      };
      
      // 根据是否显示图标来决定文字布局
      if (showIcon && customIcon) {
        // 显示图标时：左侧文字（图标左边，右对齐）
        if (leftText) {
          drawText(leftText, iconX - spacing, 'right');
        }
        
        // 右侧文字（图标右边，左对齐）
        if (rightText) {
          drawText(rightText, iconX + iconSize + spacing, 'left');
        }
      } else {
        // 不显示图标时：两侧文字合并居中显示
        const combinedText = leftText && rightText ? `${leftText}${rightText}` : leftText || rightText;
        if (combinedText) {
          tempCtx.textAlign = 'center';
          tempCtx.textBaseline = 'middle';
          
          // 应用文字阴影
          if (textShadow.opacity > 0) {
            tempCtx.shadowColor = `${textShadow.color}${Math.round(textShadow.opacity * 255).toString(16).padStart(2, '0')}`;
            tempCtx.shadowBlur = textShadow.blur;
            tempCtx.shadowOffsetX = textShadow.x;
            tempCtx.shadowOffsetY = textShadow.y;
          }
          
          // 绘制描边
           if (textStroke.enabled && textStroke.width > 0) {
             tempCtx.strokeStyle = textStroke.color;
             tempCtx.lineWidth = textStroke.width;
             tempCtx.lineJoin = 'round';
             tempCtx.miterLimit = 2;
             tempCtx.strokeText(combinedText, centerX, centerY);
           }
          
          // 绘制填充文字
          tempCtx.fillStyle = finalTextColor;
          tempCtx.fillText(combinedText, centerX, centerY);
          
          // 重置阴影
          tempCtx.shadowColor = 'transparent';
          tempCtx.shadowBlur = 0;
          tempCtx.shadowOffsetX = 0;
          tempCtx.shadowOffsetY = 0;
        }
      }

      // 将临时canvas内容绘制到主canvas
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.drawImage(tempCanvas, 0, 0);

      setTimeout(() => setIsGenerating(false), 300);
    };
    
    await drawIconAndText();
  }, [leftText, rightText, selectedTemplate, bgImage, bgImageX, bgImageY, bgImageScale, bgBlur, bgOpacity, overlayEnabled, overlayBlur, overlayOpacity, showIcon, customIcon, iconSize, iconColor, iconBorderRadius, iconBgEnabled, textShadow, textStroke, customFont, fontWeight, fontSize, textColor, spacing, colorSync, autoTextColor, canvasSize]);

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = '';

    for (const char of words) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  const downloadCover = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas not found');
      alert('Canvas 未找到，请稍后重试');
      return;
    }

    console.log('Starting download...', {
      canvasSize,
      exportScale,
      exportTransparent,
      exportFilename
    });

    try {
      // 直接使用当前canvas转换为图片
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('Failed to create blob');
          alert('生成图片失败，请重试');
          return;
        }
        
        console.log('Blob created:', blob.size, 'bytes');
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const filename = exportFilename || 'cover';
        const scaleText = exportScale > 1 ? `@${exportScale}x` : '';
        link.download = `${filename}${scaleText}.png`;
        link.href = url;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        console.log('Triggering download...');
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log('Download complete');
        }, 100);
      }, 'image/png');
    } catch (error) {
      console.error('Download failed:', error);
      alert('下载失败: ' + error);
    }
  }, [exportScale, exportFilename, canvasSize]);

  useEffect(() => {
    generateCover();
  }, [generateCover]);

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="pb-20">
      <Seo title="封面生成器" description="在线生成精美的博客文章封面图片" />

      <div className="mb-8 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h1 className="mb-4 font-serif text-5xl font-bold text-ink dark:text-white md:text-6xl">封面生成器</h1>
          <p className="mx-auto max-w-2xl text-lg text-zinc-500 dark:text-zinc-400">
            快速生成精美的博客文章封面，支持自定义文字、图标和样式
          </p>
        </motion.div>
      </div>

      {/* 标签页切换 */}
      <div className="mb-6 flex justify-center gap-2">
        {(['content', 'style', 'export'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-6 py-2 font-semibold transition-all ${
              activeTab === tab
                ? 'bg-ink text-white dark:bg-white dark:text-ink'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            {tab === 'content' ? '内容' : tab === 'style' ? '样式' : '导出'}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* 左侧控制面板 */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-6 lg:col-span-1">
          
          {/* 内容标签页 */}
          {activeTab === 'content' && (
            <>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center gap-2">
                  <Type className="text-ink dark:text-white" size={20} />
                  <h3 className="font-bold text-ink dark:text-white">文字内容</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-zinc-600 dark:text-zinc-400">左侧文字</label>
                    <input
                      type="text"
                      value={leftText}
                      onChange={(e) => setLeftText(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ink/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
                      placeholder="输入左侧文字"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-zinc-600 dark:text-zinc-400">右侧文字</label>
                    <input
                      type="text"
                      value={rightText}
                      onChange={(e) => setRightText(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      placeholder="输入右侧文字"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="text-ink dark:text-white" size={20} />
                    <h3 className="font-bold text-ink dark:text-white">图标</h3>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showIcon}
                      onChange={(e) => setShowIcon(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">显示图标</span>
                  </label>
                </div>

                {showIcon && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setShowIconifyModal(true)}
                        className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-600 transition-colors hover:border-ink hover:bg-ink/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-white dark:hover:bg-white/5"
                      >
                        <Search size={16} />
                        搜索图标
                      </button>
                      
                      <input
                        ref={iconInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleIconUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => iconInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-600 transition-colors hover:border-ink hover:bg-ink/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-white dark:hover:bg-white/5"
                      >
                        <Upload size={16} />
                        上传图标
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center gap-2">
                  <Palette className="text-ink dark:text-white" size={20} />
                  <h3 className="font-bold text-ink dark:text-white">背景模板</h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {templates.map((template) => (
                    <motion.button
                      key={template.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedTemplate(template)}
                      className={`relative h-20 overflow-hidden rounded-lg border-2 transition-all ${
                        selectedTemplate.id === template.id
                          ? 'border-ink shadow-lg shadow-ink/20 dark:border-white dark:shadow-white/20'
                          : 'border-zinc-200 dark:border-zinc-700'
                      }`}
                      style={{ background: template.gradient }}
                      title={template.description}
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="text-xs font-bold text-white drop-shadow-lg">{template.name}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div className="mt-4">
                  <input
                    ref={bgImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBgImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => bgImageInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-600 transition-colors hover:border-ink hover:bg-ink/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-white dark:hover:bg-white/5"
                  >
                    <Upload size={16} />
                    上传背景图片
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 样式标签页 */}
          {activeTab === 'style' && (
            <>
              {/* 快捷预设 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="text-accent" size={20} />
                  <h3 className="font-bold text-ink dark:text-white">快捷预设</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setFontSize(72);
                      setFontWeight(700);
                      setIconSize(80);
                      setSpacing(32);
                      setTextShadow({ x: 2, y: 2, blur: 8, color: '#000000', opacity: 0.3 });
                      setTextStroke({ enabled: false, width: 2, color: '#000000' });
                      setIconBorderRadius(12);
                      setIconBgEnabled(true);
                    }}
                    className="rounded-lg border-2 border-zinc-200 bg-gradient-to-br from-zinc-50 to-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700 transition-all hover:border-accent hover:from-accent/5 hover:to-accent/10 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-300"
                  >
                    默认风格
                  </button>
                  
                  <button
                    onClick={() => {
                      setFontSize(80);
                      setFontWeight(900);
                      setIconSize(100);
                      setSpacing(40);
                      setTextShadow({ x: 4, y: 4, blur: 12, color: '#000000', opacity: 0.5 });
                      setTextStroke({ enabled: true, width: 4, color: '#000000' });
                      setIconBorderRadius(20);
                      setIconBgEnabled(true);
                    }}
                    className="rounded-lg border-2 border-zinc-200 bg-gradient-to-br from-purple-50 to-purple-100 px-4 py-3 text-sm font-semibold text-purple-700 transition-all hover:border-purple-400 dark:border-zinc-700 dark:from-purple-900/20 dark:to-purple-900/30 dark:text-purple-300"
                  >
                    醒目风格
                  </button>
                  
                  <button
                    onClick={() => {
                      setFontSize(60);
                      setFontWeight(400);
                      setIconSize(64);
                      setSpacing(24);
                      setTextShadow({ x: 0, y: 0, blur: 0, color: '#000000', opacity: 0 });
                      setTextStroke({ enabled: false, width: 2, color: '#000000' });
                      setIconBorderRadius(0);
                      setIconBgEnabled(false);
                    }}
                    className="rounded-lg border-2 border-zinc-200 bg-gradient-to-br from-blue-50 to-blue-100 px-4 py-3 text-sm font-semibold text-blue-700 transition-all hover:border-blue-400 dark:border-zinc-700 dark:from-blue-900/20 dark:to-blue-900/30 dark:text-blue-300"
                  >
                    简约风格
                  </button>
                  
                  <button
                    onClick={() => {
                      setFontSize(68);
                      setFontWeight(600);
                      setIconSize(72);
                      setSpacing(28);
                      setTextShadow({ x: 0, y: 4, blur: 16, color: '#000000', opacity: 0.4 });
                      setTextStroke({ enabled: false, width: 2, color: '#000000' });
                      setIconBorderRadius(50);
                      setIconBgEnabled(true);
                    }}
                    className="rounded-lg border-2 border-zinc-200 bg-gradient-to-br from-pink-50 to-pink-100 px-4 py-3 text-sm font-semibold text-pink-700 transition-all hover:border-pink-400 dark:border-zinc-700 dark:from-pink-900/20 dark:to-pink-900/30 dark:text-pink-300"
                  >
                    柔和风格
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center gap-2">
                  <Type className="text-ink dark:text-white" size={20} />
                  <h3 className="font-bold text-ink dark:text-white">文字样式</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                      <span>字体大小</span>
                      <span className="text-ink dark:text-white">{fontSize}px</span>
                    </label>
                    <input
                      type="range"
                      min="24"
                      max="120"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full accent-ink dark:accent-white"
                    />
                  </div>

                  <div>
                    <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                      <span>文字间距</span>
                      <span className="text-ink dark:text-white">{spacing}px</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={spacing}
                      onChange={(e) => setSpacing(Number(e.target.value))}
                      className="w-full accent-ink dark:accent-white"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={autoTextColor}
                        onChange={(e) => setAutoTextColor(e.target.checked)}
                        className="accent-ink dark:accent-white"
                      />
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">自动反色（根据背景）</span>
                    </label>
                  </div>

                  {!autoTextColor && (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-zinc-600 dark:text-zinc-400">文字颜色</label>
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                      />
                    </div>
                  )}

                  <div>
                    <input
                      ref={fontInputRef}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={handleFontUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fontInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-gradient-to-r from-zinc-50 to-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-600 transition-all hover:border-ink hover:text-ink dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-400 dark:hover:border-white dark:hover:text-white"
                    >
                      <Upload size={16} />
                      上传自定义字体
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                      <span>字体粗细</span>
                      <span className="text-ink dark:text-white">{fontWeight}</span>
                    </label>
                    <input
                      type="range"
                      min="100"
                      max="900"
                      step="100"
                      value={fontWeight}
                      onChange={(e) => setFontWeight(Number(e.target.value))}
                      className="w-full accent-ink dark:accent-white"
                    />
                  </div>
                </div>
              </div>

              {/* 文字描边设置 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Type className="text-ink dark:text-white" size={20} />
                    <h3 className="font-bold text-ink dark:text-white">文字描边</h3>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={textStroke.enabled}
                      onChange={(e) => setTextStroke({ ...textStroke, enabled: e.target.checked })}
                      className="accent-ink dark:accent-white"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">启用</span>
                  </label>
                </div>

                {textStroke.enabled && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        <span>描边宽度</span>
                        <span className="text-ink dark:text-white">{textStroke.width}px</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={textStroke.width}
                        onChange={(e) => setTextStroke({ ...textStroke, width: Number(e.target.value) })}
                        className="w-full accent-ink dark:accent-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-zinc-600 dark:text-zinc-400">描边颜色</label>
                      <input
                        type="color"
                        value={textStroke.color}
                        onChange={(e) => setTextStroke({ ...textStroke, color: e.target.value })}
                        className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 文字阴影设置 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center gap-2">
                  <Type className="text-ink dark:text-white" size={20} />
                  <h3 className="font-bold text-ink dark:text-white">文字阴影</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                      <span>阴影透明度</span>
                      <span className="text-ink dark:text-white">{Math.round(textShadow.opacity * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={textShadow.opacity}
                      onChange={(e) => setTextShadow({ ...textShadow, opacity: Number(e.target.value) })}
                      className="w-full accent-ink dark:accent-white"
                    />
                  </div>

                  {textShadow.opacity > 0 && (
                    <>
                      <div>
                        <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                          <span>模糊半径</span>
                          <span className="text-ink dark:text-white">{textShadow.blur}px</span>
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={textShadow.blur}
                          onChange={(e) => setTextShadow({ ...textShadow, blur: Number(e.target.value) })}
                          className="w-full accent-ink dark:accent-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                            <span>X 偏移</span>
                            <span className="text-ink dark:text-white">{textShadow.x}px</span>
                          </label>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            value={textShadow.x}
                            onChange={(e) => setTextShadow({ ...textShadow, x: Number(e.target.value) })}
                            className="w-full accent-ink dark:accent-white"
                          />
                        </div>

                        <div>
                          <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                            <span>Y 偏移</span>
                            <span className="text-ink dark:text-white">{textShadow.y}px</span>
                          </label>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            value={textShadow.y}
                            onChange={(e) => setTextShadow({ ...textShadow, y: Number(e.target.value) })}
                            className="w-full accent-ink dark:accent-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-zinc-600 dark:text-zinc-400">阴影颜色</label>
                        <input
                          type="color"
                          value={textShadow.color}
                          onChange={(e) => setTextShadow({ ...textShadow, color: e.target.value })}
                          className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {showIcon && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-4 flex items-center gap-2">
                    <ImageIcon className="text-ink dark:text-white" size={20} />
                    <h3 className="font-bold text-ink dark:text-white">图标样式</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        <span>图标大小</span>
                        <span className="text-ink dark:text-white">{iconSize}px</span>
                      </label>
                      <input
                        type="range"
                        min="32"
                        max="200"
                        value={iconSize}
                        onChange={(e) => setIconSize(Number(e.target.value))}
                        className="w-full accent-ink dark:accent-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-zinc-600 dark:text-zinc-400">图标颜色</label>
                      <input
                        type="color"
                        value={iconColor}
                        onChange={(e) => setIconColor(e.target.value)}
                        className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                      />
                    </div>

                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        <span>圆角</span>
                        <span className="text-ink dark:text-white">{iconBorderRadius}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={iconBorderRadius}
                        onChange={(e) => setIconBorderRadius(Number(e.target.value))}
                        className="w-full accent-ink dark:accent-white"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={iconBgEnabled}
                          onChange={(e) => setIconBgEnabled(e.target.checked)}
                          className="accent-ink dark:accent-white"
                        />
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">显示图标背景</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* 背景遮罩设置 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="text-ink dark:text-white" size={20} />
                    <h3 className="font-bold text-ink dark:text-white">背景遮罩</h3>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={overlayEnabled}
                      onChange={(e) => setOverlayEnabled(e.target.checked)}
                      className="accent-ink dark:accent-white"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">启用</span>
                  </label>
                </div>

                {overlayEnabled && (
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        <span>模糊程度</span>
                        <span className="text-ink dark:text-white">{overlayBlur}px</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={overlayBlur}
                        onChange={(e) => setOverlayBlur(Number(e.target.value))}
                        className="w-full accent-ink dark:accent-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        <span>遮罩透明度</span>
                        <span className="text-ink dark:text-white">{overlayOpacity}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={overlayOpacity}
                        onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                        className="w-full accent-ink dark:accent-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {bgImage && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-4 flex items-center gap-2">
                    <ImageIcon className="text-ink dark:text-white" size={20} />
                    <h3 className="font-bold text-ink dark:text-white">背景图片</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        <span>模糊</span>
                        <span className="text-ink dark:text-white">{bgBlur}px</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="20"
                        value={bgBlur}
                        onChange={(e) => setBgBlur(Number(e.target.value))}
                        className="w-full accent-ink dark:accent-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        <span>不透明度</span>
                        <span className="text-ink dark:text-white">{bgOpacity}%</span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={bgOpacity}
                        onChange={(e) => setBgOpacity(Number(e.target.value))}
                        className="w-full accent-ink dark:accent-white"
                      />
                    </div>

                    <button
                      onClick={() => setBgImage(null)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-50 to-red-100 px-4 py-3 text-sm font-semibold text-red-600 transition-all hover:from-red-100 hover:to-red-200 dark:from-red-900/20 dark:to-red-900/30 dark:text-red-400"
                    >
                      <X size={16} />
                      移除背景图片
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 导出标签页 */}
          {activeTab === 'export' && (
            <>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex items-center gap-2">
                  <ImageIcon className="text-ink dark:text-white" size={20} />
                  <h3 className="font-bold text-ink dark:text-white">导出设置</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-zinc-600 dark:text-zinc-400">宽高比</label>
                    <div className="grid grid-cols-4 gap-2">
                      {exportRatios.map((ratio) => (
                        <button
                          key={ratio.label}
                          onClick={() => {
                            setExportRatios(exportRatios.map(r => ({ ...r, active: r.label === ratio.label })));
                          }}
                          className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all ${
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
                    <label className="mb-2 flex items-center justify-between text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                      <span>导出倍率</span>
                      <span className="text-ink dark:text-white">{exportScale}x</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.5"
                      value={exportScale}
                      onChange={(e) => setExportScale(Number(e.target.value))}
                      className="w-full accent-ink dark:accent-white"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-zinc-600 dark:text-zinc-400">文件名</label>
                    <input
                      type="text"
                      value={exportFilename}
                      onChange={(e) => setExportFilename(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-ink outline-none transition-all focus:border-ink focus:ring-2 focus:ring-ink/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
                      placeholder="cover"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportTransparent}
                        onChange={(e) => setExportTransparent(e.target.checked)}
                        className="accent-ink dark:accent-white"
                      />
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">透明背景</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={generateCover}
                  disabled={isGenerating}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-zinc-100 to-zinc-200 px-4 py-3 font-semibold text-ink transition-all hover:from-zinc-200 hover:to-zinc-300 disabled:opacity-50 dark:from-zinc-800 dark:to-zinc-700 dark:text-white dark:hover:from-zinc-700 dark:hover:to-zinc-600"
                >
                  <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
                  重新生成
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={downloadCover}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ink to-zinc-800 px-4 py-3 font-semibold text-white shadow-lg shadow-ink/25 transition-all hover:shadow-xl hover:shadow-ink/30 dark:from-white dark:to-zinc-200 dark:text-ink dark:shadow-white/25 dark:hover:shadow-white/30"
                >
                  <Download size={18} />
                  下载封面
                </motion.button>
              </div>
            </>
          )}
        </motion.div>

        {/* 右侧预览区域 */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <ImageIcon className="text-ink dark:text-white" size={20} />
              <h3 className="font-bold text-ink dark:text-white">实时预览</h3>
              <span className="ml-auto text-xs text-zinc-400">{canvasSize.width} × {canvasSize.height} px</span>
            </div>

            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
              <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                className="w-full cursor-move"
                style={{ aspectRatio: `${activeRatio.w}/${activeRatio.h}` }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onWheel={handleCanvasWheel}
              />
            </div>

            <div className="mt-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 text-ink dark:text-white" size={16} />
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <p className="font-semibold">使用提示：</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>• 在"内容"标签页中输入文字、选择图标和背景模板</li>
                    <li>• 在"样式"标签页中调整字体、颜色、阴影、描边等效果</li>
                    <li>• 在"导出"标签页中设置宽高比、导出倍率和文件名</li>
                    <li>• 上传背景图片后可以拖拽移动、滚轮缩放调整位置</li>
                    <li>• 支持搜索 Iconify 图标库或上传自定义图标</li>
                    <li>• 默认启用文字阴影和图标圆角，让封面更精美</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
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
                <h3 className="text-xl font-bold text-ink dark:text-white">搜索 Iconify 图标</h3>
                <button
                  onClick={() => setShowIconifyModal(false)}
                  className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <input
                    type="text"
                    value={iconifySearch}
                    onChange={(e) => {
                      setIconifySearch(e.target.value);
                      searchIconify(e.target.value);
                    }}
                    placeholder="搜索图标，例如：home, user, settings..."
                    className="w-full rounded-lg border border-zinc-200 bg-white py-3 pl-10 pr-4 text-ink outline-none transition-colors focus:border-ink focus:ring-2 focus:ring-ink/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin text-ink dark:text-white" size={32} />
                  </div>
                ) : iconifyResults.length > 0 ? (
                  <div className="grid grid-cols-6 gap-3">
                    {iconifyResults.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => selectIconifyIcon(icon)}
                        className="flex aspect-square items-center justify-center rounded-lg border-2 border-zinc-200 bg-zinc-50 p-3 transition-all hover:border-ink hover:bg-ink/5 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-white dark:hover:bg-white/5"
                        title={icon}
                      >
                        <img
                          src={`https://api.iconify.design/${icon}.svg`}
                          alt={icon}
                          className="h-full w-full"
                        />
                      </button>
                    ))}
                  </div>
                ) : iconifySearch ? (
                  <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    未找到相关图标，请尝试其他关键词
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    输入关键词搜索图标
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
