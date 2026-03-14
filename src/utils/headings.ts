import React from 'react';

const INLINE_MARKDOWN_PATTERNS: Array<[RegExp, string]> = [
  [/!\[([^\]]*)\]\([^)]+\)/g, '$1'],
  [/\[([^\]]+)\]\([^)]+\)/g, '$1'],
  [/`([^`]*)`/g, '$1'],
  [/<[^>]+>/g, ''],
  [/(\*\*|__|\*|_|~~)/g, ''],
  [/\\([\\`*_[\]{}()#+\-.!>])/g, '$1']
];

export const stripInlineMarkdown = (text: string) => {
  return INLINE_MARKDOWN_PATTERNS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text
  )
    .replace(/\s+#+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const slugifyHeading = (text: string) => {
  return stripInlineMarkdown(text)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

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
