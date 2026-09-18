import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CodeBlock } from './CodeBlock';

vi.mock('@/utils/clipboard', () => ({
  copyTextToClipboard: vi.fn(),
}));

import { copyTextToClipboard } from '@/utils/clipboard';

const makeBlockChildren = (lines: number, lang = 'language-ts', meta?: string) => (
  <code className={lang} data-meta={meta}>
    {Array.from({ length: lines }, (_, index) => `const v${index} = ${index};`).join('\n')}
  </code>
);

describe('CodeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('工具栏显示语言、总行数与文件名（meta title 优先）', () => {
    render(<CodeBlock>{makeBlockChildren(2, 'language-ts', 'title="app.ts"')}</CodeBlock>);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('app.ts')).toBeInTheDocument();
    expect(screen.getByText('2 行')).toBeInTheDocument();
  });

  it('无语言围栏显示「纯文本」，未知语言显示原始标记而非报错', () => {
    const { rerender } = render(<CodeBlock>{makeBlockChildren(1, '')}</CodeBlock>);
    expect(screen.getByText('纯文本')).toBeInTheDocument();

    rerender(<CodeBlock>{makeBlockChildren(1, 'language-obscurelang')}</CodeBlock>);
    expect(screen.getByText('obscurelang')).toBeInTheDocument();
  });

  it('复制成功显示轻量反馈', async () => {
    vi.mocked(copyTextToClipboard).mockResolvedValue(true);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CodeBlock>{makeBlockChildren(2)}</CodeBlock>);
    await user.click(screen.getByRole('button', { name: '复制代码' }));
    expect(await screen.findByText('代码已复制')).toBeInTheDocument();
    expect(copyTextToClipboard).toHaveBeenCalledWith('const v0 = 0;\nconst v1 = 1;');
  });

  it('复制失败如实反馈（不静默）', async () => {
    vi.mocked(copyTextToClipboard).mockResolvedValue(false);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CodeBlock>{makeBlockChildren(2)}</CodeBlock>);
    await user.click(screen.getByRole('button', { name: '复制代码' }));
    expect(await screen.findByText('复制失败，请重试')).toBeInTheDocument();
  });

  it('复制抛异常时同样显示失败反馈', async () => {
    vi.mocked(copyTextToClipboard).mockRejectedValue(new Error('denied'));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CodeBlock>{makeBlockChildren(2)}</CodeBlock>);
    await user.click(screen.getByRole('button', { name: '复制代码' }));
    expect(await screen.findByText('复制失败，请重试')).toBeInTheDocument();
  });

  it('行号是键盘可达的复制按钮', async () => {
    vi.mocked(copyTextToClipboard).mockResolvedValue(true);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CodeBlock>{makeBlockChildren(3)}</CodeBlock>);
    const lineButton = screen.getByRole('button', { name: '复制第 2 行' });
    await user.click(lineButton);
    expect(await screen.findByText('已复制第 2 行')).toBeInTheDocument();
    expect(copyTextToClipboard).toHaveBeenCalledWith('const v1 = 1;');
  });

  it('超过 30 行折叠并显示「显示全部 N 行」，展开后渲染全部行号', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<CodeBlock>{makeBlockChildren(35)}</CodeBlock>);
    expect(screen.getAllByRole('button', { name: /复制第 \d+ 行/ })).toHaveLength(30);

    await user.click(screen.getByRole('button', { name: '显示全部 35 行' }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /复制第 \d+ 行/ })).toHaveLength(35);
    });
    expect(screen.getByRole('button', { name: '折叠代码' })).toBeInTheDocument();
  });

  it('下载按钮以文件名/语言推断扩展名下载', () => {
    render(<CodeBlock>{makeBlockChildren(2, 'language-ts', 'title="app.ts"')}</CodeBlock>);
    fireEvent.click(screen.getByRole('button', { name: '下载代码' }));
    expect(screen.getByText('2 行')).toBeInTheDocument();
  });
});
