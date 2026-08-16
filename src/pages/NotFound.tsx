/**
 * 404 页：页面不存在提示（带当前路径调试信息），noindex。
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NotFoundState } from '@/components/NotFoundState';
import { Seo } from '@/components/Seo';

export const NotFound: React.FC = () => {
  const location = useLocation();
  // 调试路径不能在渲染期直接输出 location.pathname：SSG 用占位路由
  // /__missing__ 预渲染 404 页（scripts/ssg.mjs），构建后再把静态 HTML 中
  // 的 /__missing__ 替换为 / —— 客户端在真实未知路径（如 /foo）水合时，
  // 若首帧直接渲染 location.pathname 会与 SSR 文本不一致触发水合警告。
  // 首帧输出占位符（两端一致），挂载后 effect 再写入真实路径。
  const [clientPath, setClientPath] = useState('—');

  useEffect(() => {
    setClientPath(location.pathname);
  }, [location.pathname]);

  return (
    // Layout.tsx 已渲染 <main> 包裹路由内容，此处不再嵌套 <main>（HTML 规范禁止
    // main 嵌套 main，无障碍工具对嵌套 landmark 解析混乱）。
    <div>
      <Seo title="页面不存在" description="你访问的页面不存在，可能已经移动或删除。" noindex />
      <NotFoundState
        title="页面走丢了"
        description="你访问的页面不存在，可能已经移动、重命名，或者链接本身已经失效。"
        debugLabel={`Path: ${clientPath}`}
      />
    </div>
  );
};
