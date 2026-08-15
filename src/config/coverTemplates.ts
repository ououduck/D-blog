export interface CoverTemplate {
  id: string;
  name: string;
  gradient: string;
  description?: string;
  category?: 'dark' | 'light';
}

export const coverTemplates: CoverTemplate[] = [
  {
    id: 'black',
    name: '纯黑',
    gradient: 'linear-gradient(135deg, #000000 0%, #000000 100%)',
    description: '纯黑色背景',
    category: 'dark',
  },
  {
    id: 'white',
    name: '纯白',
    gradient: 'linear-gradient(135deg, #ffffff 0%, #ffffff 100%)',
    description: '纯白色背景',
    category: 'light',
  },
];

export const defaultTemplate = coverTemplates.find((t) => t.id === 'black') || coverTemplates[0];
