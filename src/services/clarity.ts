import { ClaritySnapshot } from '../types';

let clarityCache: ClaritySnapshot | null = null;

export const getClaritySnapshot = async (): Promise<ClaritySnapshot> => {
  if (clarityCache) {
    return clarityCache;
  }

  const data = await import('../../generated/clarity.json');
  clarityCache = data.default as ClaritySnapshot;
  return clarityCache;
};
