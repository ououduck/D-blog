import { describe, it, expect } from 'vitest';
import { getInitialFriends, getFriends } from './friends';

describe('friends 服务', () => {
  it('getInitialFriends 返回构建期内联的友链列表（不包含打乱顺序）', () => {
    const initial = getInitialFriends();
    expect(Array.isArray(initial)).toBe(true);
    // 数据由 gen:data 生成，至少应包含完整字段
    for (const friend of initial) {
      expect(typeof friend.name).toBe('string');
      expect(typeof friend.url).toBe('string');
      expect(typeof friend.avatar).toBe('string');
      expect(typeof friend.description).toBe('string');
    }
  });

  it('getFriends 会话内多次调用返回稳定顺序（只打乱一次）', async () => {
    const first = await getFriends();
    const second = await getFriends();
    expect(first.map((friend) => friend.name)).toEqual(second.map((friend) => friend.name));
  });

  it('getFriends 返回与初始列表相同的成员（仅顺序可能不同）', async () => {
    const initial = getInitialFriends();
    const shuffled = await getFriends();
    expect(shuffled.map((friend) => friend.name).sort()).toEqual(initial.map((friend) => friend.name).sort());
  });
});
