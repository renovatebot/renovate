import { mocked, partial } from '../../../test/util';
import * as _repositoryCache from '../cache/repository';
import type { BranchCache, RepoCacheData } from '../cache/repository/types';
import { setBranchCommit } from './set-branch-commit';
import * as _git from '.';

jest.mock('.');
jest.mock('../cache/repository');
const git = mocked(_git);
const repositoryCache = mocked(_repositoryCache);

describe('util/git/set-branch-commit', () => {
  let repoCache: RepoCacheData = {};

  beforeEach(() => {
    repoCache = {};
    repositoryCache.getCache.mockReturnValue(repoCache);
  });

  describe('setBranchCommit', () => {
    it('sets new branch in cache if it doesn not exist', () => {
      git.getBranchCommit.mockReturnValueOnce('base_SHA');
      expect(setBranchCommit('branch_name', 'base_branch', 'SHA')).toEqual({
        baseBranch: 'base_branch',
        baseBranchSha: 'base_SHA',
        branchName: 'branch_name',
        isBehindBase: false,
        isConflicted: false,
        isModified: false,
        parentSha: 'base_SHA',
        sha: 'SHA',
      });
    });

    it('sets new values in branch when old state exists', () => {
      repoCache = {
        branches: [
          partial<BranchCache>({
            baseBranch: 'base_branch',
            baseBranchSha: 'base_SHA',
            branchName: 'branch_name',
            isBehindBase: true,
            isConflicted: true,
            isModified: true,
            parentSha: 'base_SHA',
            sha: 'SHA',
          }),
        ],
      };
      git.getBranchCommit.mockReturnValueOnce('base_SHA');
      repositoryCache.getCache.mockReturnValue(repoCache);
      expect(setBranchCommit('branch_name', 'base_branch', 'SHA')).toEqual({
        baseBranch: 'base_branch',
        baseBranchSha: 'base_SHA',
        branchName: 'branch_name',
        isBehindBase: false,
        isConflicted: false,
        isModified: false,
        parentSha: 'base_SHA',
        sha: 'SHA',
      });
    });
  });
});
