import { mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import { setBranchShas } from './set-branch-sha';
import * as _git from '.';

jest.mock('../cache/repository');
jest.mock('.');
const repositoryCache = mocked(_repositoryCache);
const git = mocked(_git);

describe('util/git/set-branch-sha', () => {
  describe('setBranchShas()', () => {
    let repoCache: RepoCacheData;

    beforeEach(() => {
      repoCache = {};
      repositoryCache.getCache.mockReturnValue(repoCache);
    });

    it('populates cache when branch is created', () => {
      git.getBranchCommit.mockReturnValue('base_SHA');
      setBranchShas('branch', 'base_branch', 'SHA');
      expect(repoCache.branches).toMatchObject([
        {
          branchName: 'branch',
          baseBranchName: 'base_branch',
          sha: 'SHA',
          baseBranchSha: 'base_SHA',
          parentSha: 'base_SHA',
          isModified: false,
          isConflicted: false,
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
          parentSha: 'base_SHA_old',
          isModified: true,
          isConflicted: true,
        }),
        partial<BranchCache>({
          branchName: 'branch-2',
          baseBranchName: 'base_branch-2',
          sha: 'SHA_2',
          baseBranchSha: 'base_SHA_2',
          parentSha: 'base_SHA_2',
          isModified: true,
          isConflicted: true,
        }),
      ];
      git.getBranchCommit.mockReturnValue('base_SHA_new');
      setBranchShas('branch', 'base_branch', 'SHA_new');
      expect(repoCache.branches).toMatchObject([
        {
          branchName: 'branch',
          baseBranchName: 'base_branch',
          sha: 'SHA_new',
          baseBranchSha: 'base_SHA_new',
          parentSha: 'base_SHA_new',
          isModified: false,
          isConflicted: false,
        },
        {
          branchName: 'branch-2',
          baseBranchName: 'base_branch-2',
          sha: 'SHA_2',
          baseBranchSha: 'base_SHA_2',
          parentSha: 'base_SHA_2',
          isModified: true,
          isConflicted: true,
        },
      ]);
    });
  });
});
