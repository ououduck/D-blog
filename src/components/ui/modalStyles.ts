export type ModalSurfaceVariant = 'dialog' | 'sheet';

export const modalStyles = {
  root: 'fixed inset-0 z-[110] flex justify-center',
  backdrop: 'fixed inset-0 bg-black/50 dark:bg-black/70',
  surface: {
    dialog: 'relative z-10 mx-4 w-full max-w-lg max-h-[80vh] overflow-hidden rounded-overlay border border-zinc-300 bg-paper shadow-none dark:border-zinc-700 dark:bg-zinc-900',
    sheet: 'editorial-sheet relative z-10 w-full max-h-[85vh] overflow-hidden border border-b-0 border-zinc-300 bg-paper shadow-none dark:border-zinc-700 dark:bg-zinc-900',
  } satisfies Record<ModalSurfaceVariant, string>,
  header: 'flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800',
  body: 'overflow-y-auto',
  closeButton: 'inline-flex h-9 w-9 items-center justify-center rounded-icon border border-transparent text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
} as const;

export const modalSurfaceStyles = modalStyles.surface;
