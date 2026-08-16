/**
 * 搜索 URL 查询参数工具：统一 Home/Archive/Tags/Search 四页的
 * 「输入搜索词 ↔ ?q= 参数」同步逻辑（各自实现易漂移）。
 *
 * 约定：空查询删除 q 参数；页面级衍生参数（page 页码、year 年份等）在
 * 搜索/清除时一并删除，避免残留筛选状态与搜索语义冲突。
 */

/** 按输入更新 q 参数：空查询删除 q，同时删除传入的衍生参数（如 page/year）。 */
export const setSearchQueryParams = (
  previous: URLSearchParams,
  query: string,
  paramsToDelete: string[] = [],
): URLSearchParams => {
  const nextParams = new URLSearchParams(previous);
  if (query.trim()) {
    nextParams.set('q', query);
  } else {
    nextParams.delete('q');
  }
  paramsToDelete.forEach((key) => nextParams.delete(key));
  return nextParams;
};

/** 清除搜索（删除 q 与传入的衍生参数）。 */
export const clearSearchQueryParams = (
  previous: URLSearchParams,
  paramsToDelete: string[] = [],
): URLSearchParams => {
  const nextParams = new URLSearchParams(previous);
  nextParams.delete('q');
  paramsToDelete.forEach((key) => nextParams.delete(key));
  return nextParams;
};
