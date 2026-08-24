/**
 * 搜索输入框：放大镜图标 + 清除按钮 + 可选尾部操作（endAction），带 iOS 聚焦字号防放大处理。
 *
 * IME 组合状态的自愈设计：组合标记（isComposingRef）若因异常路径卡在 true，
 * 后续输入会被永久忽略（表现为"输入框无法输入"）。除失焦复位外，还提供
 * Escape 取消复位与超时看门狗两条兜底路径，保证任何输入法/浏览器组合下
 * 输入框都不会被卡死。
 *
 * 组合结束补发的完整值必须取「包含组合文本的 DOM value」（DOM 滞后时用
 * 组合前快照 + event.data 重建）——event.data 只含本次组合的确认文本，
 * 用它整体替换会在多次组合/中英混输时抹掉已输入内容（"无法输入汉字"的
 * 另一根因）。
 */

import React, { forwardRef, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

type SearchFieldSize = 'default' | 'large';

interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'onChange'> {
  size?: SearchFieldSize;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  endAction?: React.ReactNode;
  containerClassName?: string;
  /**
   * IME 组合看门狗超时（毫秒），默认 5000。组合开始后若长时间没有组合相关
   * 输入活动（部分浏览器/输入法取消组合时不派发 compositionend），自动复位
   * 组合标记，保证输入框永远不会被永久卡死。测试可注入小值加速验证。
   */
  compositionWatchdogMs?: number;
}

const variantClasses =
  'border-zinc-300 bg-paper focus:border-zinc-900 dark:border-zinc-700 dark:bg-void dark:focus:border-zinc-100';

/**
 * 组合看门狗超时（毫秒）：组合开始后若长时间没有组合相关输入活动（部分
 * 浏览器/输入法取消组合时不派发 compositionend，Escape、切换输入法、移动端
 * 键盘异常等路径），自动复位组合标记，保证输入框永远不会被永久卡死。
 * 组合期间每次 input 事件都会重新武装看门狗，正常输入不会被误判。
 */
const DEFAULT_COMPOSITION_WATCHDOG_MS = 5000;

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      size = 'default',
      value,
      onValueChange,
      onClear,
      clearLabel = '清除搜索',
      endAction,
      className = '',
      containerClassName = '',
      disabled,
      compositionWatchdogMs = DEFAULT_COMPOSITION_WATCHDOG_MS,
      ...inputProps
    },
    ref,
  ) => {
    // 中文输入法（IME）组合期间的中间态（拼音未确认）不应触发搜索：
    // compositionstart/end 之间忽略 onChange，组合结束时补一次完整值。
    const isComposingRef = useRef(false);
    // 组合结束时刻（performance.now）：部分浏览器组合确认时 compositionend 先于
    // keydown 派发（Chrome 反之），确认拼音的 Enter 在 isComposing 已复位的情况下
    // 会漏进上层快捷键处理（如搜索弹窗的 Enter 导航），跳到上一次搜索的旧结果。
    // 组合结束瞬间（<80ms）的 Enter 视为 IME 确认的尾随事件直接吞掉。
    const compositionEndedAtRef = useRef(0);
    // 组合看门狗定时器：见 DEFAULT_COMPOSITION_WATCHDOG_MS 注释。
    const compositionWatchdogRef = useRef<number | null>(null);
    // 组合开始时的输入值快照与选区：compositionend 时若 DOM value 尚未提交组合
    // 文本（部分浏览器滞后），用「组合前快照 + 组合确认文本」重建完整值。
    // 不能直接用 compositionend 的 event.data —— 它只含本次组合的文本，用它整体
    // 替换会抹掉组合前已输入的内容（多次组合/中英混输时表现为"无法输入汉字"）。
    const valueBeforeCompositionRef = useRef<string | null>(null);
    const compositionSelectionRef = useRef<{ start: number; end: number } | null>(null);
    const hasValue = typeof value === 'string' || typeof value === 'number' ? String(value).length > 0 : false;
    const showClear = Boolean(onClear && hasValue && !disabled);
    const inputSpacing = endAction ? (showClear ? 'pr-24' : 'pr-14') : showClear ? 'pr-11' : 'pr-4';
    // iOS Safari 会对聚焦时字号 < 16px 的输入框自动放大页面（导致布局跳动、固定
    // 导航/弹窗错位）。移动端基础字号保持 16px，桌面端（sm 起）再缩回 14px，
    // 桌面浏览器不受此限制。真正决定缩放的是 font-size 而非控件高度。
    const sizeClass = size === 'large' ? 'h-14 text-base sm:text-lg' : 'h-11 text-[16px] sm:text-sm';
    const clearButtonSizeClass = size === 'large' ? 'h-14' : 'h-11';

    const clearCompositionWatchdog = () => {
      if (compositionWatchdogRef.current !== null) {
        window.clearTimeout(compositionWatchdogRef.current);
        compositionWatchdogRef.current = null;
      }
    };

    // 复位组合标记：失焦 / Escape 取消组合 / 看门狗超时共用，清除挂起定时器。
    const resetComposing = () => {
      isComposingRef.current = false;
      clearCompositionWatchdog();
    };

    // 武装/重置看门狗：组合开始或组合期间有输入活动时调用。
    const armCompositionWatchdog = () => {
      clearCompositionWatchdog();
      compositionWatchdogRef.current = window.setTimeout(() => {
        compositionWatchdogRef.current = null;
        // 超时仍未收到 compositionend：组合已被静默取消，复位标记避免
        // 后续输入被永久忽略（"输入框无法输入"的根因）。
        isComposingRef.current = false;
      }, compositionWatchdogMs);
    };

    useEffect(() => () => clearCompositionWatchdog(), []);

    return (
      <div className={`group relative min-w-0 ${disabled ? 'opacity-75' : ''} ${containerClassName}`}>
        <Search
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:text-zinc-500 dark:group-focus-within:text-zinc-100"
        />
        <input
          {...inputProps}
          ref={ref}
          type="search"
          value={value}
          onChange={(event) => {
            // 组合进行中：忽略中间态（拼音），但重新武装看门狗 —— 持续
            // 输入说明组合仍在进行，不应触发超时复位。除 isComposingRef 外
            // 同时检查原生 isComposing：看门狗误复位（组合仍实际进行）时
            // 拼音中间态也不会漏进搜索，组合结束后的尾随 input 事件
            // （isComposing=false、value 为完整值）则正常放行。
            if (isComposingRef.current || (event.nativeEvent as InputEvent).isComposing) {
              armCompositionWatchdog();
              return;
            }
            onValueChange?.(event.target.value);
          }}
          onCompositionStart={(event) => {
            isComposingRef.current = true;
            armCompositionWatchdog();
            // 快照组合前状态（值 + 选区），供 compositionend 重建完整值。
            const target = event.currentTarget;
            valueBeforeCompositionRef.current = target.value;
            compositionSelectionRef.current = {
              start: target.selectionStart ?? target.value.length,
              end: target.selectionEnd ?? target.value.length,
            };
          }}
          onCompositionEnd={(event) => {
            resetComposing();
            // 记录组合结束时刻，供 onKeyDown 拦截 IME 确认 Enter 的尾随 keydown。
            compositionEndedAtRef.current = performance.now();
            // 组合结束补发一次完整值，让防抖搜索基于最终中文。关键：不能用
            // event.data 整体替换 —— 它只含本次组合的确认文本（如"世界"），
            // 多次组合或中英混输时会把已输入内容全部抹掉（"无法输入汉字"的
            // 根因）。取包含组合文本的完整 DOM value；DOM 滞后时用组合前快照
            // + 组合确认文本重建（部分浏览器 compositionend 派发时 value 尚未
            // 更新到确认文本，读 currentTarget.value 会拿到旧值/拼音）。
            const composedText = event.data || '';
            const currentValue = event.currentTarget.value;
            const valueBefore = valueBeforeCompositionRef.current;
            const selection = compositionSelectionRef.current;
            valueBeforeCompositionRef.current = null;
            compositionSelectionRef.current = null;

            let fullValue: string;
            if (composedText && currentValue.includes(composedText)) {
              // 主流浏览器：compositionend 时 DOM value 已含组合文本，直接取完整值。
              fullValue = currentValue;
            } else if (valueBefore !== null) {
              // DOM 滞后或组合被取消（data 为空）：用组合前快照重建；
              // 组合前有选中文本时按选区替换（组合文本替换选区内容）。
              fullValue =
                selection && selection.start !== selection.end
                  ? valueBefore.slice(0, selection.start) + composedText + valueBefore.slice(selection.end)
                  : valueBefore + composedText;
            } else {
              fullValue = currentValue || composedText;
            }

            // 与受控值一致（如取消组合/重复确认同一文本）时跳过，避免无谓更新。
            if (fullValue !== value) {
              onValueChange?.(fullValue);
            }
          }}
          onKeyDown={(event) => {
            // Escape 取消组合：部分 IME（尤其移动端）取消时不派发
            // compositionend，组合标记会永久卡在 true 导致后续输入被忽略。
            if (event.key === 'Escape' && isComposingRef.current) {
              resetComposing();
            }
            // 组合结束瞬间的 Enter 是 IME 确认的尾随事件（compositionend 先于
            // keydown 派发的浏览器里 isComposing 已复位，上层会误当"确认搜索"），
            // 拦截后由防抖搜索在组合结束补发的完整值上继续；之后的 Enter 正常放行。
            if (event.key === 'Enter' && performance.now() - compositionEndedAtRef.current < 80) {
              event.preventDefault();
              return;
            }
            inputProps.onKeyDown?.(event);
          }}
          onBlur={(event) => {
            // 防御：组合进行中失焦（点击清除按钮/移开焦点）时，若浏览器未派发
            // compositionend（取消组合的派发行为因浏览器/输入法而异），组合标记
            // 会永久卡在 true 导致后续输入全部被忽略。失焦即复位，保证状态不粘滞。
            resetComposing();
            inputProps.onBlur?.(event);
          }}
          disabled={disabled}
          className={`w-full min-w-0 appearance-none rounded-control border pl-10 text-ink outline-none transition-[background-color,border-color,color,box-shadow] duration-150 placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/15 disabled:cursor-not-allowed dark:text-white dark:placeholder:text-zinc-500 dark:hover:border-zinc-600 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/15 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden ${variantClasses} ${sizeClass} ${inputSpacing} ${className}`}
        />
        {(showClear || endAction) && (
          <div className="absolute inset-y-0 right-0 flex items-center">
            {showClear && (
              <button
                type="button"
                onClick={onClear}
                className={`inline-flex ${clearButtonSizeClass} w-10 items-center justify-center text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100`}
                aria-label={clearLabel}
              >
                <X size={16} />
              </button>
            )}
            {endAction}
          </div>
        )}
      </div>
    );
  },
);

SearchField.displayName = 'SearchField';
