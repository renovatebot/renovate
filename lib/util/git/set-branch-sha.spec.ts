import { mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import { setBranchCommit } from './set-branch-sha';

jest.mock('../cache/repository');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/set-branch-sha', () => {
  describe('setBranchCommit()', () => {
    let repoCache: RepoCacheData;

    beforeEach(() => {
      repoCache = {};
      repositoryCache.getCache.mockReturnValue(repoCache);
    });

    it('populates empty cache', () => {
      setBranchCommit(
        'branch',
        'SHA',
        'base_branch',
        'base_SHA',
        'fingerprint'
      );
      expect(repoCache.branches).toMatchObject([
        {
          branchName: 'branch',
          baseBranchName: 'base_branch',
          sha: 'SHA',
          baseBranchSha: 'base_SHA',
          isBehindBaseBranch: false,
          isModified: false,
          isConflicted: false,
          branchFingerprint: 'fingerprint',
        },
      ]);
    });

    it('updates cache if branch exists', () => {
      repoCache.branches = [
        partial<BranchCache>({
          branchName: 'branch',
          baseBranchName: 'base_branch',
          sha: 'SHA_old',
          baseBranchSha: 'base_SHA_old',
          isBehindBaseBranch: false,
          isModified: true,
          isConflicted: true,
        }),
        partial<BranchCache>({
          branchName: 'branch-2',
          baseBranchName: 'base_branch-2',
          sha: 'SHA_2',
          baseBranchSha: 'base_SHA_2',
          isBehindBaseBranch: false,
          isModified: true,
          isConflicted: true,
        }),
      ];
      setBranchCommit(
        'branch',
        'SHA_new',
        'base_branch',
        'base_SHA_new',
        'fingerprint'
      );
      expect(repoCache.branches).toMatchObject([
        {
          branchName: 'branch',
          baseBranchName: 'base_branch',
          sha: 'SHA_new',
          baseBranchSha: 'base_SHA_new',
          isBehindBaseBranch: false,
          isModified: false,
          isConflicted: false,
          branchFingerprint: 'fingerprint',
        },
        {
          branchName: 'branch-2',
          baseBranchName: 'base_branch-2',
          sha: 'SHA_2',
          baseBranchSha: 'base_SHA_2',
          isBehindBaseBranch: false,
          isModified: true,
          isConflicted: true,
        },
      ]);
    });
  });
});
