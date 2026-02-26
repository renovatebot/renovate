import { partial } from '~test/util.ts';
import * as _repositoryCache from '../cache/repository/index.ts';
import type { BranchCache, RepoCacheData } from '../cache/repository/types.ts';
import { getCachedPristineResult } from './pristine.ts';

vi.mock('../cache/repository/index.ts');
const repositoryCache = vi.mocked(_repositoryCache);

describe('util/git/pristine', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('getCachedPristineResult', () => {
    it('returns false if cache is not populated', () => {
      expect(getCachedPristineResult('foo')).toBeFalse();
    });

    it('returns false if branch not found', () => {
      repoCache.branches = [partial<BranchCache>({ branchName: 'not_foo' })];
      expect(getCachedPristineResult('foo')).toBeFalse();
    });

    it('returns true', () => {
      repoCache.branches = [
        partial<BranchCache>({
          branchName: 'foo',
          pristine: true,
        }),
      ];
      expect(getCachedPristineResult('foo')).toBeTrue();
    });
  });
});
