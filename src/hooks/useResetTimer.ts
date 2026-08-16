/**
 * 可重复调度的复位定时器 hook：供「复制成功」等临时反馈的自动清除使用。
 * schedule 会先取消上一次未触发的定时器再重新计时（连续操作不提前复位）；
 * 组件卸载时自动清理。统一 ShareModal / ShuoShuoShareModal 各自实现的
 * clearResetTimer + scheduleReset 样板。
 */
import { useCallback, useEffect, useRef } from 'react';

export const useResetTimer = (): {
  /** 取消未触发的定时器（幂等）。 */
  clear: () => void;
  /** 取消旧的并重新调度：delayMs 后执行 callback。 */
  schedule: (callback: () => void, delayMs: number) => void;
} => {
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(
    (callback: () => void, delayMs: number) => {
      clear();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        callback();
      }, delayMs);
    },
    [clear],
  );

  useEffect(() => clear, [clear]);

  return { clear, schedule };
};
