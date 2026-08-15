import { Friend } from '../types';

// 构建期 SSG：friends.json 通过 eager glob 内联进产物，SSR 阶段即可同步渲染友链列表，
// 爬虫无需执行 JS 即可读取全部友链（与 posts.ts 的 posts.json 模式一致）。
const generatedFriendModules = import.meta.glob<Friend[]>('../../generated/friends.json', {
  eager: true,
  import: 'default',
});
const initialFriends = Object.values(generatedFriendModules)[0] ?? [];

let shuffledCache: Friend[] | null = null;

const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

/** 同步读取构建期内联的友链原始列表（SSG / 首帧渲染用），不包含打乱顺序。 */
export const getInitialFriends = (): Friend[] => initialFriends;

export const getFriends = async (): Promise<Friend[]> => {
  // 会话内只打乱一次：多次调用返回稳定顺序，避免列表顺序在每次渲染时随机变化。
  if (!shuffledCache) {
    shuffledCache = shuffle(initialFriends);
  }
  return shuffledCache;
};
