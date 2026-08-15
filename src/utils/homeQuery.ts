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

export const getHomeQueryState = (params: URLSearchParams): HomeQueryState => ({
  sortOrder: params.get('sort') === 'oldest' ? 'oldest' : 'newest',
  page: parsePage(params.get('page')),
});

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
};

export const canonicalizeHomeQuery = (params: URLSearchParams) => {
  const state = getHomeQueryState(params);
  let nextParams = setHomeQueryParam(params, 'sort', state.sortOrder);
  nextParams = setHomeQueryParam(nextParams, 'page', state.page);
  return nextParams;
};
