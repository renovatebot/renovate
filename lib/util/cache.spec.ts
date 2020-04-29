import { getRepoCache } from './cache';

describe('getRepoCache', () => {
  it('returns the global cache', () => {
    expect(getRepoCache()).toBeDefined();
  });
});
