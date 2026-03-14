import React from 'react';

const INLINE_MARKDOWN_PATTERNS: Array<[RegExp, string]> = [
  [/!\[([^\]]*)\]\([^)]+\)/g, '$1'],
  [/\[([^\]]+)\]\([^)]+\)/g, '$1'],
  [/`([^`]*)`/g, '$1'],
  [/<[^>]+>/g, ''],
  [/(\*\*|__|\*|_|~~)/g, ''],
  [/\\([\\`*_[\]{}()#+\-.!>])/g, '$1']
];
const MARKDOWN_HEADING_PATTERN = /^(#{1,3})\s+(.+)$/gm;
const TOC_EMOJI_PATTERN = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu;

export interface MarkdownHeading {
  id: string;
  level: number;
  rawText: string;
  text: string;
}

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

export const stripEmojiFromHeadingText = (text: string) => {
  return text
    .replace(TOC_EMOJI_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const createUniqueHeadingId = (baseId: string, seenIds: Map<string, number>) => {
  const normalizedBaseId = baseId || 'section';
  const duplicateCount = (seenIds.get(normalizedBaseId) ?? 0) + 1;

  seenIds.set(normalizedBaseId, duplicateCount);

  return duplicateCount === 1 ? normalizedBaseId : `${normalizedBaseId}-${duplicateCount}`;
};

export const extractMarkdownHeadings = (content: string): MarkdownHeading[] => {
  const seenIds = new Map<string, number>();
  const headings: MarkdownHeading[] = [];

  for (const match of content.matchAll(MARKDOWN_HEADING_PATTERN)) {
    const level = match[1]?.length ?? 1;
    const rawText = stripInlineMarkdown(match[2] ?? '');
    const text = stripEmojiFromHeadingText(rawText) || rawText;
    const id = createUniqueHeadingId(slugifyHeading(rawText) || slugifyHeading(text), seenIds);

    headings.push({
      id,
      level,
      rawText,
      text
    });
  }

  return headings;
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
