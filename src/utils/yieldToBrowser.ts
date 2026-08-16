/**
 * 让出主线程（yield to browser）：把剩余工作排到下一个宏任务。
 * 用于长循环（批量封面逐项渲染/打包等）中定期让出，避免长时间独占主线程
 * 导致页面卡顿或"无响应"提示。提取为共享工具，统一 CoverGenerator 与
 * coverBatch 的既有实现。
 */
export const yieldToBrowser = (): Promise<void> =>
  new Promise((resolve) => {
    // 优先 MessageChannel：调度快于 setTimeout(0)，且不受嵌套定时器 4ms 钳制；
    // 不可用（极旧环境）时回退 setTimeout。
    if (typeof MessageChannel !== 'undefined') {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
      return;
    }
    setTimeout(resolve, 0);
  });
