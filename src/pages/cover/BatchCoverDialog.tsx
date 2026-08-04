import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useModalOverlay } from '../../hooks/useModalOverlay';
import { parseBatchText, type BatchCoverItem, type BatchParseIssue } from './coverBatch';

interface BatchCoverDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (items: BatchCoverItem[]) => void;
}

export const BatchCoverDialog: React.FC<BatchCoverDialogProps> = ({ isOpen, onClose, onGenerate }) => {
  const [items, setItems] = useState<BatchCoverItem[]>([]);
  const [issues, setIssues] = useState<BatchParseIssue[]>([]);
  const [isReading, setIsReading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useModalOverlay({
    isOpen,
    onClose,
    initialFocusRef: fileInputRef,
    containerRef: dialogRef,
  });

  if (!isOpen) return null;

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setIsReading(true); setItems([]); setIssues([]);
    const nextItems: BatchCoverItem[] = []; const nextIssues: BatchParseIssue[] = [];
    for (const file of files) {
      const result = parseBatchText(await file.text(), file.name);
      nextItems.push(...result.items); nextIssues.push(...result.issues.map((issue) => ({ ...issue, message: `${file.name}：${issue.message}` })));
    }
    setItems(nextItems); setIssues(nextIssues); setIsReading(false); event.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="batch-cover-title" tabIndex={-1} className="editorial-overlay max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 id="batch-cover-title" className="text-xl font-bold text-ink dark:text-white">批量生成封面</h2>
          <button type="button" onClick={onClose} aria-label="关闭批量生成" className="rounded-icon p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={18} /></button>
        </div>
        <p className="mb-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">上传 Markdown、CSV 或 JSON，读取 title、subtitle/description 和 slug；生成结果只会下载为 ZIP，不会修改文章文件。</p>
        <label className="flex cursor-pointer items-center justify-center rounded-control border border-dashed border-zinc-400 px-4 py-4 text-sm font-semibold text-zinc-700 hover:border-ink dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-white">
          选择数据文件
          <input ref={fileInputRef} type="file" multiple accept=".md,.markdown,.csv,.json,text/markdown,text/csv,application/json" onChange={handleFiles} className="sr-only" />
        </label>
        {isReading && <p className="mt-4 text-sm text-zinc-500" role="status">正在读取文件…</p>}
        {issues.length > 0 && <ul className="mt-4 space-y-1 rounded-control border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="alert">{issues.map((issue, index) => <li key={`${issue.line}-${index}`}>第 {issue.line} 行：{issue.message}</li>)}</ul>}
        {items.length > 0 && (
          <>
            <div className="mt-4 rounded-control border border-zinc-200 dark:border-zinc-700">
              <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500 dark:border-zinc-700">已读取 {items.length} 条</div>
              <ul className="max-h-56 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-700">{items.map((item) => <li key={item.slug} className="flex items-center gap-3 px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-semibold text-ink dark:text-white">{item.title}</span><span className="text-xs text-zinc-400">{item.slug}</span></li>)}</ul>
            </div>
            <button type="button" onClick={() => onGenerate(items)} className="mt-4 w-full rounded-control bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-ink dark:hover:bg-zinc-200">开始生成 ZIP</button>
          </>
        )}
      </div>
    </div>
  );
};

export default BatchCoverDialog;
