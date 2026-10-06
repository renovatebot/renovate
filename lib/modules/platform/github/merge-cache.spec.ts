import { getCache, resetCache } from '../../../util/cache/repository/index.ts';
import {
  clearPendingMerge,
  getPendingMerge,
  setPendingMerge,
} from './merge-cache.ts';

describe('modules/platform/github/merge-cache', () => {
  beforeEach(() => {
    resetCache();
  });

  it('returns undefined if no merge is pending', () => {
    expect(getPendingMerge(1)).toBeUndefined();
  });

  it('stores and clears a pending merge', () => {
    setPendingMerge(1, 'uuid-1');

    expect(getPendingMerge(1)).toEqual({
      uuid: 'uuid-1',
      requestedAt: expect.any(String),
    });

    clearPendingMerge(1);

    expect(getPendingMerge(1)).toBeUndefined();
  });

  it('keeps other GitHub cache data', () => {
    getCache().platform = { github: { issuesCache: {} } };

    setPendingMerge(1, 'uuid-1');

    expect(getCache().platform?.github).toEqual({
      issuesCache: {},
      pendingMerges: {
        1: { uuid: 'uuid-1', requestedAt: expect.any(String) },
      },
    });
  });
});
