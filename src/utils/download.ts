/**
 * Blob 下载工具：创建 object URL 并触发 <a download> 点击下载。
 *
 * 统一各导出/下载入口（封面导出、代码块下载、图片查看器、水印导出）的
 * 挂载-点击-延迟释放时序：部分浏览器（Firefox/Safari）对"未挂载的 <a> +
 * 立即 revoke"会中断或忽略下载，延迟释放避免下载被中止。
 */
export const downloadBlob = (blob: Blob, filename: string, revokeDelayMs = 1000): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), revokeDelayMs);
};
