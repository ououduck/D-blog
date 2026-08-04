import React from 'react';
import {
  extractMarkdownHeadings,
  slugifyHeading,
  stripInlineMarkdown
} from './headings-core.mjs';

export interface MarkdownHeading {
  id: string;
  level: number;
  rawText: string;
  text: string;
}

export { extractMarkdownHeadings, slugifyHeading, stripInlineMarkdown };

export const stripEmojiFromHeadingText = (text: string) => text
  .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

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
