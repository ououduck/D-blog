/** 封面生成器画布尺寸预设（16:9 / 1:1 / 4:3 / 21:9 / 1.91:1）。 */
import type { CoverRatio } from '../pages/cover/coverTypes';

/** 封面画布尺寸预设（label 用于 UI 展示与草稿序列化）。 */
export const coverSizePresets: readonly CoverRatio[] = [
  { label: '16:9', w: 16, h: 9 },
  { label: '1:1', w: 1, h: 1 },
  { label: '4:3', w: 4, h: 3 },
  { label: '21:9', w: 21, h: 9 },
  { label: '1.91:1', w: 1.91, h: 1 },
];
