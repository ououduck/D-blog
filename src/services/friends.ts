import { Friend } from '../types';

let friendsDataCache: Friend[] | null = null;

const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
};

const loadFriendsData = async (): Promise<Friend[]> => {
  if (friendsDataCache) {
    return friendsDataCache;
  }

  const data = await import('../../generated/friends.json');
  friendsDataCache = data.default as Friend[];
  return friendsDataCache;
};

export const getFriends = async (): Promise<Friend[]> => {
  const friends = await loadFriendsData();
  return shuffle(friends);
};
