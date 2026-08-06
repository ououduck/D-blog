import { describe, expect, it } from 'vitest';
import { getPaginationItems } from './Pagination';

describe('getPaginationItems', () => {
  it('returns every page when the page count is small', () => {
    expect(getPaginationItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the first and last pages with ellipses for large page counts', () => {
    expect(getPaginationItems(5, 10)).toEqual([1, 'ellipsis-start', 4, 5, 6, 'ellipsis-end', 10]);
  });

  it('does not add invalid neighboring pages at the boundaries', () => {
    expect(getPaginationItems(1, 10)).toEqual([1, 2, 'ellipsis-end', 10]);
    expect(getPaginationItems(10, 10)).toEqual([1, 'ellipsis-start', 9, 10]);
  });
});
