const INLINE_MARKDOWN_PATTERNS = [
  [/!\[([^\]]*)\]\([^)]+\)/g, '$1'],
  [/\[([^\]]+)\]\([^)]+\)/g, '$1'],
  [/`([^`]*)`/g, '$1'],
  [/<[^>]+>/g, ''],
  [/(\*\*|__|\*|_|~~)/g, ''],
  [/\\([\\`*_[\]{}()#+\-.!>])/g, '$1'],
];
// ATX 标题须在 # 与内容间有空白，或 # 后直接行尾（CommonMark 允许空标题）；
// 否则如「##快速开始」会被误判为标题（实际渲染为段落），产生幽灵 TOC 条目。
const MARKDOWN_HEADING_PATTERN =
  /^(?: {0,3}(#{1,3})(?:[ \t]+(.*)|[ \t]*$)| {0,3}([^\r\n]+)\r?\n {0,3}(=+|-+)[ \t]*)$/gm;

// 常用 HTML 命名实体 → 字符。与浏览器/remark 渲染侧的解码保持一致：
// 缺失的实体会导致 TOC 提取的标题文本与 DOM 渲染文本不一致，锚点 id 错位。
// （数字字符引用 &#...; 与 &#x...; 走通用逻辑，不在此表。）
const HTML_ENTITY_REPLACEMENTS = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  // 标点与符号
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  middot: '·',
  bull: '•',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  sect: '§',
  para: '¶',
  dagger: '†',
  Dagger: '‡',
  permil: '‰',
  prime: '′',
  Prime: '″',
  larr: '←',
  uarr: '↑',
  rarr: '→',
  darr: '↓',
  harr: '↔',
  spades: '♠',
  clubs: '♣',
  hearts: '♥',
  diams: '♦',
  check: '✓',
  cross: '✗',
  star: '★',
  // 数学
  frac12: '½',
  frac13: '⅓',
  frac14: '¼',
  frac23: '⅔',
  frac34: '¾',
  sup2: '²',
  sup3: '³',
  micro: 'µ',
  infin: '∞',
  ne: '≠',
  le: '≤',
  ge: '≥',
  sum: '∑',
  prod: '∏',
  radic: '√',
  int: '∫',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  pi: 'π',
  Omega: 'Ω',
  // 货币
  cent: '¢',
  pound: '£',
  yen: '¥',
  euro: '€',
  // 空白
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
};

const isValidCodePoint = (value) => Number.isInteger(value) && value >= 0 && value <= 0x10ffff;

const decodeHtmlEntities = (text) =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entity, value) => {
    const normalized = value.toLowerCase();
    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    // 先按原始大小写查表（&Dagger; → ‡、&Prime; → ″、&Omega; → Ω 等大写键），
    // 再退回小写（HTML 实体名大小写不敏感，但表中同时存在 dagger/Dagger 时
    // 直接小写会把 &Dagger; 错解成 †）。
    return HTML_ENTITY_REPLACEMENTS[value] ?? HTML_ENTITY_REPLACEMENTS[normalized] ?? entity;
  });

/** Mask fenced and indented code while preserving line breaks for diagnostics and heading parsing. */
export const maskFencedCodeBlocks = (markdown) => {
  // HTML 多行注释内可能出现 # 开头的行（草稿/临时注释），会被误当成真实标题
  // 提取进 TOC/锚点。先整体遮蔽注释区（保留换行与列位），再逐行处理代码块；
  // 顺带避免注释内的 ``` 围栏干扰代码块遮蔽。
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\r\n]/g, ' '));
  const lines = withoutComments.split(/(?<=\n)/);
  let fence = null;
  let indentedCode = false;
  return lines
    .map((line) => {
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

      const isIndented = /^(?: {4}|\t)/.test(line);
      if (isIndented) {
        indentedCode = true;
        return line.replace(/[^\r\n]/g, ' ');
      }
      if (indentedCode && (/^\s*$/.test(line) || /^(?: {4}|\t)/.test(line))) {
        return line.replace(/[^\r\n]/g, ' ');
      }
      indentedCode = false;
      return line;
    })
    .join('');
};

export const stripInlineMarkdown = (text) =>
  decodeHtmlEntities(
    INLINE_MARKDOWN_PATTERNS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text),
  )
    .replace(/\s+#+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

export const slugifyHeading = (text) =>
  stripInlineMarkdown(text)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');

const stripEmojiFromHeadingText = (text) =>
  text
    // 拆分字符类：Emoji 修饰符/变体选择器/ZWJ/Keycap 与 Pictographic 类组合会被
    // no-misleading-character-class 判定为误导性序列，分开替换语义等价且规则友好。
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}]/gu, '')
    .replace(/\uFE0F|\u200D|\u20E3/g, '')
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
    const rawText = stripInlineMarkdown(isSetext ? match[3] : (match[2] ?? ''));
    const text = stripEmojiFromHeadingText(rawText) || rawText;
    const id = createUniqueHeadingId(slugifyHeading(rawText) || slugifyHeading(text), seenIds);
    headings.push({ id, level, rawText, text });
  }
  return headings;
};
