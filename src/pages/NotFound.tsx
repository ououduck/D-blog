import React from 'react';
import { useLocation } from 'react-router-dom';
import { NotFoundState } from '@/components/NotFoundState';

export const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    <NotFoundState
      title="页面走丢了"
      description="你访问的页面不存在，可能已经移动、重命名，或者链接本身已经失效。"
      debugLabel={`Path: ${location.pathname}`}
    />
  );
};
