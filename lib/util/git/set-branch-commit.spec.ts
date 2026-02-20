import { DateTime } from 'luxon';
import { git, logger, partial } from '~test/util.ts';
import * as _repositoryCache from '../cache/repository/index.ts';
import type { BranchCache, RepoCacheData } from '../cache/repository/types.ts';
import { setBranchNewCommit } from './set-branch-commit.ts';
import type { LongCommitSha } from './types.ts';

vi.mock('../cache/repository/index.ts');
vi.mock('./index.ts');
const repositoryCache = vi.mocked(_repositoryCache);

describe('util/git/set-branch-commit', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('setBranchCommit', () => {
    it('sets new branch in cache if it does not exist', () => {
      git.getBranchCommit.mockReturnValueOnce('base_SHA' as LongCommitSha);
      setBranchNewCommit('branch_name', 'base_branch', 'SHA', null);

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
      git.getBranchCommit.mockReturnValueOnce('base_SHA' as LongCommitSha);
      repositoryCache.getCache.mockReturnValue(repoCache);
      setBranchNewCommit('branch_name', 'base_branch', 'SHA', null);
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

    it('sets commitTimestamp when DateTime is provided', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            branchName: 'branch_name',
            baseBranch: 'base_branch',
            sha: 'old_SHA',
            baseBranchSha: 'base_SHA',
          }),
        ],
      };
      const commitDate = DateTime.fromISO('2023-05-20T14:25:30.123Z').toUTC();
      git.getBranchCommit.mockReturnValueOnce('base_SHA' as LongCommitSha);
      repositoryCache.getCache.mockReturnValue(repoCache);
      setBranchNewCommit('branch_name', 'base_branch', 'new_SHA', commitDate);
      expect(repoCache.branches).toEqual([
        {
          branchName: 'branch_name',
          baseBranch: 'base_branch',
          sha: 'new_SHA',
          baseBranchSha: 'base_SHA',
          isBehindBase: false,
          isModified: false,
          isConflicted: false,
          pristine: true,
          commitTimestamp: '2023-05-20T14:25:30.123Z',
        },
      ]);
    });
  });
});
