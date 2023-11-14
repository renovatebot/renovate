import { git, logger, mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import { setBranchNewCommit } from './set-branch-commit';

jest.mock('../cache/repository');
jest.mock('.');
const repositoryCache = mocked(_repositoryCache);

describe('util/git/set-branch-commit', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('setBranchCommit', () => {
    it('sets new branch in cache if it does not exist', () => {
      git.getBranchCommit.mockReturnValueOnce('base_SHA');
      setBranchNewCommit('branch_name', 'base_branch', 'SHA');
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'setBranchCommit(): Branch cache not present',
      );
      expect(repoCache.branches).toEqual([
        {
          branchName: 'branch_name',
          baseBranch: 'base_branch',
          sha: 'SHA',
          baseBranchSha: 'base_SHA',
          isBehindBase: false,
          isConflicted: false,
          isModified: false,
          pristine: true,
        },
      ]);
    });

    it('sets new values in branch when old state exists', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch_name',
            baseBranch: 'base_branch',
            sha: 'SHA',
            baseBranchSha: 'base_SHA',
            isBehindBase: false,
            isModified: true,
            pristine: false,
            isConflicted: true,
          }),
        ],
      };
      git.getBranchCommit.mockReturnValueOnce('base_SHA');
      repositoryCache.getCache.mockReturnValue(repoCache);
      setBranchNewCommit('branch_name', 'base_branch', 'SHA');
      expect(repoCache.branches).toEqual([
        {
          branchName: 'branch_name',
          baseBranch: 'base_branch',
          sha: 'SHA',
          baseBranchSha: 'base_SHA',
          isBehindBase: false,
          isModified: false,
          isConflicted: false,
          pristine: true,
        },
      ]);
    });
  });
});
