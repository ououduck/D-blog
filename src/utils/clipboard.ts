/**
 * 将文本复制到剪贴板（全站通用）。
 *
 * 优先使用异步 Clipboard API（仅在安全上下文可用），失败或不可用时回退到
 * 隐藏 textarea + document.execCommand('copy')，保证 http / 旧浏览器也能复制。
 * 返回是否复制成功。
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API 被拒绝时回退到 execCommand 路径。
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } finally {
    document.body.removeChild(textArea);
  }

  return copied;
};
