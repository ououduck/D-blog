export interface CoverTemplate {
  id: string;
  name: string;
  gradient: string;
  pattern: 'dots' | 'grid' | 'waves' | 'solid';
  description?: string;
}

export const coverTemplates: CoverTemplate[] = [
  {
    id: 'black',
    name: '纯黑',
    gradient: 'linear-gradient(135deg, #000000 0%, #000000 100%)',
    pattern: 'solid',
    description: '纯黑色背景'
  },
  {
    id: 'white',
    name: '纯白',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #ffffff 100%)',
    pattern: 'solid',
    description: '纯白色背景'
  }
];

export const defaultTemplate = coverTemplates[0];
