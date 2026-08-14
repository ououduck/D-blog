import JSZip from 'jszip';

export interface BatchCoverItem {
  title: string;
  subtitle: string;
  description: string;
  slug: string;
  sourceName?: string;
}

export interface BatchParseIssue {
  line: number;
  message: string;
}

interface BatchParseResult {
  items: BatchCoverItem[];
  issues: BatchParseIssue[];
}

interface BatchRenderResult {
  filename: string;
  blob: Blob;
}

const normalizeText = (value: unknown): string => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

function sanitizeBatchSlug(value: string, fallback = 'cover'): string {
  const slug = normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function itemFromRecord(record: Record<string, unknown>, index: number, sourceName?: string): BatchCoverItem | null {
  const title = normalizeText(record.title || record.name);
  if (!title) return null;
  const subtitle = normalizeText(record.subtitle || record.category);
  const description = normalizeText(record.description || record.excerpt);
  const slug = sanitizeBatchSlug(normalizeText(record.slug || record.id || title), `cover-${index + 1}`);
  return { title, subtitle, description, slug, sourceName };
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(field); field = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field); field = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = []; continue;
    }
    field += char;
  }
  row.push(field); if (row.some((value) => value.trim())) rows.push(row);
  const headers = (rows.shift() || []).map((header) => header.trim().toLowerCase());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function parseMarkdownFrontmatter(text: string, sourceName?: string): BatchCoverItem | null {
  const match = text.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    fields[key] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return itemFromRecord(fields, 0, sourceName);
}

export function parseBatchText(text: string, filename = 'input'): BatchParseResult {
  const extension = filename.split('.').pop()?.toLowerCase();
  const items: BatchCoverItem[] = []; const issues: BatchParseIssue[] = [];
  if (extension === 'json') {
    try {
      const parsed = JSON.parse(text) as unknown;
      const records = Array.isArray(parsed) ? parsed : [parsed];
      records.forEach((record, index) => {
        const item = record && typeof record === 'object' ? itemFromRecord(record as Record<string, unknown>, index, filename) : null;
        if (item) items.push(item); else issues.push({ line: index + 1, message: '缺少 title 字段' });
      });
    } catch { issues.push({ line: 1, message: 'JSON 格式无效' }); }
  } else if (extension === 'csv') {
    parseCsv(text).forEach((record, index) => {
      const item = itemFromRecord(record, index, filename);
      if (item) items.push(item); else issues.push({ line: index + 2, message: '缺少 title 字段' });
    });
  } else {
    const item = parseMarkdownFrontmatter(text, filename);
    if (item) items.push(item); else issues.push({ line: 1, message: 'Markdown 缺少有效 frontmatter 或 title' });
  }
  // 去重：对每个 slug 检查是否已使用，若冲突则追加 -2、-3… 后缀直到唯一。
  // 此前仅检查原始 slug 的重复计数，修改后的 slug（foo-2）可能与另一条目的原始 slug 冲突。
  const used = new Set<string>();
  for (const item of items) {
    if (!used.has(item.slug)) {
      used.add(item.slug);
      continue;
    }
    let suffix = 2;
    while (used.has(`${item.slug}-${suffix}`)) suffix += 1;
    item.slug = `${item.slug}-${suffix}`;
    used.add(item.slug);
  }
  return { items, issues };
}

export async function createBatchZip(
  canvases: AsyncIterable<BatchRenderResult> | Iterable<BatchRenderResult>,
  onProgress?: (completed: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const zip = new JSZip(); let completed = 0;
  for await (const result of canvases) {
    if (signal?.aborted) throw new Error('批量生成已取消');
    zip.file(result.filename, result.blob); completed += 1; onProgress?.(completed);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return zip.generateAsync({ type: 'blob' });
}
