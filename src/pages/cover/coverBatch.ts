/**
 * 批量封面导入：解析 Markdown（front matter + 标题）、CSV 与 JSON 输入，
 * 生成封面条目列表，支持去重（slug）与 ZIP 打包导出。
 */
import JSZip from 'jszip';
import { yieldToBrowser } from '@/utils/yieldToBrowser';

export interface BatchCoverItem {
  title: string;
  subtitle: string;
  description: string;
  slug: string;
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

const normalizeText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

function sanitizeBatchSlug(value: string, fallback = 'cover'): string {
  const slug = normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function itemFromRecord(record: Record<string, unknown>, index: number): BatchCoverItem | null {
  const title = normalizeText(record.title || record.name);
  if (!title) return null;
  const subtitle = normalizeText(record.subtitle || record.category);
  const description = normalizeText(record.description || record.excerpt);
  const slug = sanitizeBatchSlug(normalizeText(record.slug || record.id || title), `cover-${index + 1}`);
  return { title, subtitle, description, slug };
}

/** CSV 已知字段名（表头识别用）：首行含任一字段视为表头行。 */
const CSV_KNOWN_FIELDS = ['title', 'name', 'subtitle', 'category', 'description', 'excerpt', 'slug', 'id'];

function parseCsv(text: string): Array<{ values: string[]; line: number }> {
  const rows: Array<{ values: string[]; line: number }> = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // 当前物理行号（随真实换行推进，含引号内换行）。
  let lineNumber = 1;
  // 当前行的起始物理行号：引号内换行推进 lineNumber 但行尚未结束，
  // 行号应取行的起始位置（「第 X 行」提示指向用户文件中的行首）。
  let rowStartLine = 1;
  const flushRow = () => {
    row.push(field);
    field = '';
    // 空行（含引号内换行造成的中间态）不产出记录；行号取行的起始物理行
    //（此前 index+2 是数据行序号，空行越多偏移越大）。
    if (row.some((value) => value.trim())) rows.push({ values: row, line: rowStartLine });
    row = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (!quoted) {
        // 非引号状态：换行是行分隔符，产出当前行。
        if (char === '\r' && next === '\n') index += 1;
        flushRow();
        lineNumber += 1;
        rowStartLine = lineNumber;
      } else {
        // 引号内的换行是字段内容的一部分，必须保留进字段；同时物理行号
        // 随真实换行推进，否则其后所有行的「第 X 行」提示系统性偏移
        //（偏移 = 引号内换行数）。
        field += char;
        if (char === '\r' && next === '\n') {
          field += next; // 保留完整的 \r\n 字段内容
          index += 1; // 跳过 \n，避免重复计行
        }
        lineNumber += 1;
      }
      continue;
    }
    field += char;
  }
  flushRow();
  return rows;
}

function parseMarkdownFrontmatter(text: string): BatchCoverItem | null {
  const match = text.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    fields[key] = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return itemFromRecord(fields, 0);
}

/**
 * 全局 slug 去重：对条目列表中的重复 slug 追加 -2、-3… 后缀直到唯一。
 * 此前仅检查原始 slug 的重复计数，修改后的 slug（foo-2）可能与另一条目的
 * 原始 slug 冲突；改为 Set 循环检查。独立导出供跨文件合并后二次调用
 * （单个 parseBatchText 只保证单文件内唯一，<input multiple> 多文件合并时
 * 同名条目会令 JSZip 静默覆盖，ZIP 内封面丢失）。
 */
export function dedupeSlugs(items: BatchCoverItem[]): BatchCoverItem[] {
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
  return items;
}

export function parseBatchText(text: string, filename = 'input'): BatchParseResult {
  const extension = filename.split('.').pop()?.toLowerCase();
  const items: BatchCoverItem[] = [];
  const issues: BatchParseIssue[] = [];
  if (extension === 'json') {
    try {
      // 兼容带 UTF-8 BOM 的文件（PowerShell/记事本导出常见）。
      const parsed = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
      const records = Array.isArray(parsed) ? parsed : [parsed];
      records.forEach((record, index) => {
        const item =
          record && typeof record === 'object' ? itemFromRecord(record as Record<string, unknown>, index) : null;
        if (item) items.push(item);
        else issues.push({ line: index + 1, message: '缺少 title 字段' });
      });
    } catch {
      issues.push({ line: 1, message: 'JSON 格式无效' });
    }
  } else if (extension === 'csv') {
    const parsedRows = parseCsv(text);
    const firstValues = parsedRows[0]?.values ?? [];
    // 无表头 CSV（每行即一条记录）：首行不含任何已知字段时当作数据行处理，
    // 否则首行按表头消费（此前的无条件 shift 会把无表头文件的首条数据吞掉）。
    const isHeaderRow = firstValues.some((value) => CSV_KNOWN_FIELDS.includes(value.trim().toLowerCase()));
    const headerValues = isHeaderRow ? firstValues : ['title', 'subtitle', 'description'];
    const dataRows = isHeaderRow ? parsedRows.slice(1) : parsedRows;
    dataRows.forEach(({ values, line }, index) => {
      const record = Object.fromEntries(headerValues.map((header, headerIndex) => [header, values[headerIndex] ?? '']));
      const item = itemFromRecord(record, index);
      if (item) items.push(item);
      else issues.push({ line, message: '缺少 title 字段' });
    });
  } else {
    // Markdown：只解析第一份 frontmatter 生成一个封面条目（多篇文档合并
    // 上传时其余正文会被忽略——批量生成以「一文档一封面」为约定，与
    // 单篇封面生成器的语义一致）。
    const item = parseMarkdownFrontmatter(text);
    if (item) items.push(item);
    else issues.push({ line: 1, message: 'Markdown 缺少有效 frontmatter 或 title' });
  }
  // 去重：对每个 slug 检查是否已使用，若冲突则追加 -2、-3… 后缀直到唯一。
  return { items: dedupeSlugs(items), issues };
}

export async function createBatchZip(
  canvases: AsyncIterable<BatchRenderResult> | Iterable<BatchRenderResult>,
  onProgress?: (completed: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const zip = new JSZip();
  let completed = 0;
  for await (const result of canvases) {
    if (signal?.aborted) throw new Error('批量生成已取消');
    zip.file(result.filename, result.blob);
    completed += 1;
    onProgress?.(completed);
    // 逐项让出主线程，避免大批量导出时页面卡顿/无响应。
    await yieldToBrowser();
  }
  return zip.generateAsync({ type: 'blob' });
}
