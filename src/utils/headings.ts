/**
 * Markdown 标题工具：从正文提取标题（含层级/锚点 id）、净化文本、slugify 与 React 节点文本提取，供 TOC 与锚点渲染共用。
 */

import React from 'react';
import { extractMarkdownHeadings, slugifyHeading, stripInlineMarkdown } from './headings-core.mjs';

export interface MarkdownHeading {
  id: string;
  level: number;
  rawText: string;
  text: string;
}

export { extractMarkdownHeadings, slugifyHeading, stripInlineMarkdown };

export const extractTextFromReactNode = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => extractTextFromReactNode(child)).join('');
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractTextFromReactNode(node.props.children);
  }

  return '';
};
