/**
 * 首页 URL 查询参数工具：sort/page 的解析、规范化与更新（canonical 防抖）。
 */

type HomeSortOrder = 'newest' | 'oldest';

interface HomeQueryState {
  sortOrder: HomeSortOrder;
  page: number;
}

const parsePage = (value: string | null) => {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
};

/** 解析 URL 查询参数为首页状态（sort 排序、page 页码，非法值回退默认）。 */
export const getHomeQueryState = (params: URLSearchParams): HomeQueryState => ({
  sortOrder: params.get('sort') === 'oldest' ? 'oldest' : 'newest',
  page: parsePage(params.get('page')),
});
/** 更新首页查询参数（sort/page），page=1 或默认排序时移除参数。 */

export const setHomeQueryParam = (params: URLSearchParams, key: 'sort' | 'page', value: HomeSortOrder | number) => {
  const nextParams = new URLSearchParams(params);

  if (key === 'sort') {
    if (value === 'oldest') {
      nextParams.set('sort', 'oldest');
    } else {
      nextParams.delete('sort');
    }
  } else if (value === 1) {
    nextParams.delete('page');
  } else {
    nextParams.set('page', String(value));
  }

  return nextParams;
  /** 归一化首页查询参数（移除无效 sort/page），保持 canonical 稳定。 */
};

export const canonicalizeHomeQuery = (params: URLSearchParams) => {
  const state = getHomeQueryState(params);
  let nextParams = setHomeQueryParam(params, 'sort', state.sortOrder);
  nextParams = setHomeQueryParam(nextParams, 'page', state.page);
  return nextParams;
};
