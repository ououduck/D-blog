// 当前模板仅使用纯色背景；如后续需要花式底纹，在此扩展 PatternType 并在
// coverRenderer 的 drawPattern 中实现对应绘制分支即可。
export type PatternType = 'solid';

export interface CoverTemplate {
  id: string;
  name: string;
  gradient: string;
  pattern: PatternType;
  description?: string;
  category?: 'dark' | 'light';
}

export const coverTemplates: CoverTemplate[] = [
  {
    id: 'black',
    name: '纯黑',
    gradient: 'linear-gradient(135deg, #000000 0%, #000000 100%)',
    pattern: 'solid',
    description: '纯黑色背景',
    category: 'dark'
  },
  {
    id: 'white',
    name: '纯白',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #ffffff 100%)',
    pattern: 'solid',
    description: '纯白色背景',
    category: 'light'
  },
];

export const defaultTemplate = coverTemplates.find(t => t.id === 'black') || coverTemplates[0];
