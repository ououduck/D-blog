import type { CoverRatio } from '../pages/cover/coverTypes';

export interface CoverSizePreset extends CoverRatio {
  id: string;
  description: string;
}

export const coverSizePresets: readonly CoverSizePreset[] = [
  { id: 'wide', label: '16:9', w: 16, h: 9, description: '视频和宽屏分享比例' },
  { id: 'square', label: '1:1', w: 1, h: 1, description: '头像、卡片和方形社交媒体封面' },
  { id: 'standard', label: '4:3', w: 4, h: 3, description: '传统文章配图比例' },
  { id: 'ultrawide', label: '21:9', w: 21, h: 9, description: '超宽横幅和标题图' },
  { id: 'og', label: '1.91:1', w: 1.91, h: 1, description: 'Open Graph 社交分享和博客链接预览' },
];
