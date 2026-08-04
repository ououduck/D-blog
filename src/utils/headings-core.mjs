const INLINE_MARKDOWN_PATTERNS = [
  [/!\[([^\]]*)\]\([^)]+\)/g, '$1'],
  [/\[([^\]]+)\]\([^)]+\)/g, '$1'],
  [/`([^`]*)`/g, '$1'],
  [/<[^>]+>/g, ''],
  [/(\*\*|__|\*|_|~~)/g, ''],
  [/\\([\\`*_[\]{}()#+\-.!>])/g, '$1']
];
const MARKDOWN_HEADING_PATTERN = /^(?: {0,3}(#{1,3})(?:[ \t]+(.*)|[ \t]*)| {0,3}([^\r\n]+)\r?\n {0,3}(=+|-+)[ \t]*)$/gm;

const HTML_ENTITY_REPLACEMENTS = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"'
};

const decodeHtmlEntities = (text) => text.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, value) => {
  const normalized = value.toLowerCase();
  if (normalized.startsWith('#x')) {
    const codePoint = Number.parseInt(normalized.slice(2), 16);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
  }
  if (normalized.startsWith('#')) {
    const codePoint = Number.parseInt(normalized.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
  }
  return HTML_ENTITY_REPLACEMENTS[normalized] ?? entity;
});

/** Mask fenced code while preserving line breaks for diagnostics and heading parsing. */
export const maskFencedCodeBlocks = (markdown) => {
  const lines = markdown.split(/(?<=\n)/);
  let fence = null;
  return lines.map((line) => {
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(?:[^`~\r\n]*)?(?:\r?\n|$)/);
    if (fence) {
      const closing = line.match(/^ {0,3}([`~]+)[ \t]*(?:\r?\n|$)/);
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) {
        fence = null;
      }
      return line.replace(/[^\r\n]/g, ' ');
    }
    if (opening) {
      fence = { character: opening[1][0], length: opening[1].length };
      return line.replace(/[^\r\n]/g, ' ');
    }
    return line;
  }).join('');
};

export const stripInlineMarkdown = (text) => decodeHtmlEntities(INLINE_MARKDOWN_PATTERNS.reduce(
  (result, [pattern, replacement]) => result.replace(pattern, replacement),
  text
)).replace(/\s+#+\s*$/, '').replace(/\s+/g, ' ').trim();

export const slugifyHeading = (text) => stripInlineMarkdown(text)
  .toLowerCase()
  .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
  .replace(/^-+|-+$/g, '');

const stripEmojiFromHeadingText = (text) => text
  .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const createUniqueHeadingId = (baseId, seenIds) => {
  const normalizedBaseId = baseId || 'section';
  const duplicateCount = (seenIds.get(normalizedBaseId) ?? 0) + 1;
  seenIds.set(normalizedBaseId, duplicateCount);
  return duplicateCount === 1 ? normalizedBaseId : `${normalizedBaseId}-${duplicateCount}`;
};

export const extractMarkdownHeadings = (content) => {
  const seenIds = new Map();
  const headings = [];
  const contentWithoutCodeBlocks = maskFencedCodeBlocks(content);
  for (const match of contentWithoutCodeBlocks.matchAll(MARKDOWN_HEADING_PATTERN)) {
    const isSetext = Boolean(match[3]);
    const level = isSetext ? (match[4][0] === '=' ? 1 : 2) : (match[1]?.length ?? 1);
    const rawText = stripInlineMarkdown(isSetext ? match[3] : match[2] ?? '');
    const text = stripEmojiFromHeadingText(rawText) || rawText;
    const id = createUniqueHeadingId(slugifyHeading(rawText) || slugifyHeading(text), seenIds);
    headings.push({ id, level, rawText, text });
  }
  return headings;
};
