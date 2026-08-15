/**
 * 拼接 CSS 类名：过滤掉空值/undefined/false，再以空格连接。
 * 供各组件合并动态类名使用（原为 Surface / ContentStatus / ProgressiveImage
 * 三处重复实现，统一收拢到本工具避免漂移）。
 */
export const mergeClassName = (...values: Array<string | undefined | false | null>) => values.filter(Boolean).join(' ');
