/**
 * 统一读取并监听用户的减少动效偏好。
 * 在 SSR 或不支持媒体查询的环境中默认返回 false。
 */
import { useMediaQuery } from './useMediaQuery';

export const useReducedMotion = (defaultValue = false): boolean =>
  useMediaQuery('(prefers-reduced-motion: reduce)', defaultValue);
