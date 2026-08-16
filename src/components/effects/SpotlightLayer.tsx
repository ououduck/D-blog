/**
 * 与 useSpotlight 配套的光斑层：一层以 --spotlight-x/y 定位的径向渐变，
 * 亮/暗主题颜色由 .editorial-spotlight 样式自动适配。放置在被绑定
 * 元素的第一个子节点位置，位于内容之下。
 */
import React from 'react';
import type { SpotlightLayerStyle } from '../../hooks/useSpotlight';

export const SpotlightLayer: React.FC<{ style: SpotlightLayerStyle }> = ({ style }) => (
  <div
    aria-hidden="true"
    className="editorial-spotlight pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 ease-out"
    style={style}
  />
);
