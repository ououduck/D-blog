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
  const selectFileButtonRef = useRef<HTMLButtonElement>(null);
  const readGenerationRef = useRef(0);
  const openFilePicker = () => fileInputRef.current?.click();

  const handleClose = () => {
    readGenerationRef.current += 1;
    setIsReading(false);
    onClose();
  };

  useModalOverlay({
    isOpen,
    onClose: handleClose,
    initialFocusRef: selectFileButtonRef,
    containerRef: dialogRef,
  });

  if (!isOpen) return null;

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const generation = ++readGenerationRef.current;
    const files = Array.from(event.target.files || []);
    setIsReading(true); setItems([]); setIssues([]);
    const nextItems: BatchCoverItem[] = []; const nextIssues: BatchParseIssue[] = [];
    try {
      for (const file of files) {
        const result = parseBatchText(await file.text(), file.name);
        if (generation !== readGenerationRef.current) return;
        nextItems.push(...result.items); nextIssues.push(...result.issues.map((issue) => ({ ...issue, message: `${file.name}：${issue.message}` })));
      }
      if (generation !== readGenerationRef.current) return;
      setItems(nextItems); setIssues(nextIssues);
    } finally {
      // 无论读取是否被取消（弹窗关闭/再次选择文件），都清空 input 值，
      // 否则下次选择同一文件时 onChange 不会触发。
      event.target.value = '';
    }
    setIsReading(false);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={handleClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="batch-cover-title" tabIndex={-1} className="editorial-overlay max-h-[88vh] w-full overflow-hidden rounded-b-none border-b-0 pb-[env(safe-area-inset-bottom,0px)] supports-[height:100dvh]:max-h-[88dvh] sm:max-w-2xl sm:rounded-overlay sm:border-b sm:pb-0" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-center px-4 pt-3 sm:hidden"><div className="h-1.5 w-14 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80" /></div>
        <div className="max-h-[calc(88vh-18px)] overflow-y-auto overscroll-contain p-5 supports-[height:100dvh]:max-h-[calc(88dvh-18px)] sm:max-h-[90vh] supports-[height:100dvh]:sm:max-h-[90dvh]">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="batch-cover-title" className="text-xl font-bold text-ink dark:text-white">批量生成封面</h2>
          <button type="button" onClick={handleClose} aria-label="关闭批量生成" title="关闭" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-icon text-zinc-500 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:hover:bg-zinc-800 dark:focus-visible:outline-white"><X size={18} /></button>
        </div>
        <p className="mb-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">上传 Markdown、CSV 或 JSON，读取 title、subtitle/description 和 slug；生成结果只会下载为 ZIP，不会修改文章文件。</p>
        <button
          ref={selectFileButtonRef}
          type="button"
          onClick={openFilePicker}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-control border border-dashed border-zinc-400 px-4 py-4 text-sm font-semibold text-zinc-700 hover:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-white dark:focus-visible:outline-white"
        >
          选择数据文件
        </button>
        <input ref={fileInputRef} type="file" multiple accept=".md,.markdown,.csv,.json,text/markdown,text/csv,application/json" onChange={handleFiles} className="sr-only" />
        {isReading && <p className="mt-4 text-sm text-zinc-500" role="status">正在读取文件…</p>}
        {issues.length > 0 && <ul className="mt-4 min-w-0 space-y-1 rounded-control border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="alert">{issues.map((issue, index) => { const message = `第 ${issue.line} 行：${issue.message}`; return <li key={`${issue.line}-${index}`} className="min-w-0 truncate" title={message}>{message}</li>; })}</ul>}
        {items.length > 0 && (
          <>
            <div className="mt-4 rounded-control border border-zinc-200 dark:border-zinc-700">
              <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500 dark:border-zinc-700">已读取 {items.length} 条</div>
              <ul className="max-h-56 divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-700">{items.map((item) => <li key={item.slug} className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-semibold text-ink dark:text-white" title={item.title}>{item.title}</span><span className="min-w-0 max-w-[45%] shrink truncate text-xs text-zinc-400" title={item.slug}>{item.slug}</span></li>)}</ul>
            </div>
            <button type="button" onClick={() => onGenerate(items)} className="mt-4 min-h-11 w-full rounded-control bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-ink dark:hover:bg-zinc-200">开始生成 ZIP</button>
          </>
        )}
        </div>
      </div>
    </div>
  );
};
