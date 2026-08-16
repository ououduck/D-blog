/**
 * 404 页：页面不存在提示（带当前路径调试信息），noindex。
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import { NotFoundState } from '@/components/NotFoundState';
import { Seo } from '@/components/Seo';

export const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    // Layout.tsx 已渲染 <main> 包裹路由内容，此处不再嵌套 <main>（HTML 规范禁止
    // main 嵌套 main，无障碍工具对嵌套 landmark 解析混乱）。
    <div>
      <Seo title="页面不存在" description="你访问的页面不存在，可能已经移动或删除。" noindex />
      <NotFoundState
        title="页面走丢了"
        description="你访问的页面不存在，可能已经移动、重命名，或者链接本身已经失效。"
        debugLabel={`Path: ${location.pathname}`}
      />
    </div>
  );
};
