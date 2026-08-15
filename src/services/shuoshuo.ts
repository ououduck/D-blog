import { ShuoShuo } from '../types';

// 构建期 SSG：shuoshuo.json 通过 eager glob 内联进产物，SSR 阶段即可同步渲染说说列表
// （与 posts.ts 的 posts.json / friends.ts 的 friends.json 模式一致）。
const generatedShuoShuoModules = import.meta.glob<ShuoShuo[]>('../../generated/shuoshuo.json', {
  eager: true,
  import: 'default'
});
const initialShuoShuo = Object.values(generatedShuoShuoModules)[0] ?? [];

/** 同步读取构建期内联的说说列表（SSG / 首帧渲染用），已按日期倒序。 */
export const getInitialShuoShuo = (): ShuoShuo[] => initialShuoShuo;
