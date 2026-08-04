import JSZip from 'jszip';
import { canvasToBlob } from './coverExport';
import { getExportFilename } from './coverLayout';
import type { ExportFormat } from './coverTypes';

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

export interface BatchParseResult {
  items: BatchCoverItem[];
  issues: BatchParseIssue[];
}

export interface BatchRenderResult {
  filename: string;
  blob: Blob;
}

const normalizeText = (value: unknown): string => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

export function sanitizeBatchSlug(value: string, fallback = 'cover'): string {
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

export function parseMarkdownFrontmatter(text: string, sourceName?: string): BatchCoverItem | null {
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
  const seen = new Map<string, number>();
  for (const item of items) {
    const count = (seen.get(item.slug) || 0) + 1; seen.set(item.slug, count);
    if (count > 1) item.slug = `${item.slug}-${count}`;
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
  }
  return zip.generateAsync({ type: 'blob' });
}

export async function canvasResults(
  items: BatchCoverItem[],
  render: (item: BatchCoverItem) => Promise<HTMLCanvasElement>,
  format: ExportFormat,
  scale: number,
  quality: number,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const results = (async function* (): AsyncGenerator<BatchRenderResult> {
    for (let index = 0; index < items.length; index += 1) {
      if (signal?.aborted) throw new Error('批量生成已取消');
      const canvas = await render(items[index]);
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await canvasToBlob(canvas, mime, format === 'jpeg' ? quality : undefined);
      const filename = getExportFilename(items[index].slug, format, scale);
      yield { filename, blob };
      onProgress?.(index + 1, items.length);
    }
  })();
  return createBatchZip(results, undefined, signal);
}
