import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import { getCachedPristineResult } from './pristine';
import { partial } from '~test/util';

vi.mock('../cache/repository');
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
