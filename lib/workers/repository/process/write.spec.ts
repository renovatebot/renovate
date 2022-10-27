import is from '@sindresorhus/is';
import {
  RenovateConfig,
  getConfig,
  git,
  logger,
  mocked,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { addMeta } from '../../../logger';
import { hashMap } from '../../../modules/manager';
import * as _repoCache from '../../../util/cache/repository';
import type {
  BranchCache,
  RepoCacheData,
} from '../../../util/cache/repository/types';
import { fingerprint } from '../../../util/fingerprint';
import { Limit, isLimitReached } from '../../global/limits';
import { BranchConfig, BranchResult, BranchUpgradeConfig } from '../../types';
import * as _branchWorker from '../update/branch';
import * as _limits from './limits';
import {
  canSkipBranchUpdateCheck,
  generateBranchFingerprintConfig,
  syncBranchState,
  writeUpdates,
} from './write';

jest.mock('../../../util/git');
jest.mock('../../../util/cache/repository');

const branchWorker = mocked(_branchWorker);
const limits = mocked(_limits);
const repoCache = mocked(_repoCache);

branchWorker.processBranch = jest.fn();

limits.getPrsRemaining = jest.fn().mockResolvedValue(99);
limits.getBranchesRemaining = jest.fn().mockResolvedValue(99);

let config: RenovateConfig;

beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
  repoCache.getCache.mockReturnValue({});
});

describe('workers/repository/process/write', () => {
  describe('writeUpdates()', () => {
    it('stops after automerge', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'test_branch',
          baseBranch: 'base',
          manager: 'npm',
          upgrades: [],
        },
        {
          branchName: 'test_branch',
          baseBranch: 'base',
          manager: 'npm',
          upgrades: [],
        },
        {
          branchName: 'test_branch',
          baseBranch: 'base',
          manager: 'npm',
          automergeType: 'pr-comment',
          ignoreTests: true,
          upgrades: [],
        },
        {
          branchName: 'test_branch',
          baseBranch: 'base',
          manager: 'npm',
          upgrades: [],
        },
        {
          branchName: 'test_branch',
          baseBranch: 'base',
          manager: 'npm',
          upgrades: [],
        },
      ];
      git.branchExists.mockReturnValue(true);
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.PrCreated,
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: false,
        result: BranchResult.AlreadyExisted,
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: false,
        result: BranchResult.Automerged,
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: false,
        result: BranchResult.Automerged,
      });
      GlobalConfig.set({ dryRun: 'full' });
      const res = await writeUpdates(config, branches);
      expect(res).toBe('automerged');
      expect(branchWorker.processBranch).toHaveBeenCalledTimes(4);
    });

    it('increments branch counter', async () => {
      const branchName = 'branchName';
      const branches: BranchConfig[] = [
        { baseBranch: 'main', branchName, upgrades: [], manager: 'npm' },
        { baseBranch: 'dev', branchName, upgrades: [], manager: 'npm' },
      ];
      repoCache.getCache.mockReturnValueOnce({});
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.PrCreated,
      });
      git.branchExists.mockReturnValueOnce(false).mockReturnValueOnce(true);
      limits.getBranchesRemaining.mockResolvedValueOnce(1);
      expect(isLimitReached(Limit.Branches)).toBeFalse();
      GlobalConfig.set({ dryRun: 'full' });
      config.baseBranches = ['main', 'dev'];
      await writeUpdates(config, branches);
      expect(isLimitReached(Limit.Branches)).toBeTrue();
      expect(addMeta).toHaveBeenCalledWith({
        baseBranch: 'main',
        branch: branchName,
      });
      expect(addMeta).toHaveBeenCalledWith({
        baseBranch: 'dev',
        branch: branchName,
      });
    });

    it('return no-work if branch fingerprint is not different', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'new/some-branch',
          baseBranch: 'base',
          manager: 'npm',
          upgrades: [
            {
              manager: 'npm',
            } as BranchUpgradeConfig,
          ],
        },
      ];
      repoCache.getCache.mockReturnValueOnce({
        branches: [
          {
            branchName: 'new/some-branch',
            sha: '111',
            branchFingerprint: '111',
          } as BranchCache,
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.NoWork,
      });
      expect(await writeUpdates(config, branches)).toBe('done');
    });

    it('updates branch fingerprint when new commit is made', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'new/some-branch',
          baseBranch: 'base',
          manager: 'npm',
          upgrades: [
            {
              manager: 'unknown-manager',
            } as BranchUpgradeConfig,
          ],
        },
      ];
      repoCache.getCache.mockReturnValueOnce({
        branches: [
          {
            branchName: 'new/some-branch',
            branchFingerprint: '222',
          } as BranchCache,
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        updatesVerified: true,
        result: BranchResult.Done,
        commitSha: 'some-value',
      });
      const branch = branches[0];
      const managers = [
        ...new Set(
          branch.upgrades
            .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
            .filter(is.string)
        ),
      ].sort();
      const branchFingerprint = fingerprint({
        branchFingerprintConfig: generateBranchFingerprintConfig(branch),
        managers,
      });
      expect(await writeUpdates(config, branches)).toBe('done');
      expect(branch.branchFingerprint).toBe(branchFingerprint);
    });

    it('caches same fingerprint when no commit is made and branch cache existed', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'new/some-branch',
          baseBranch: 'base_branch',
          manager: 'npm',
          upgrades: [
            {
              manager: 'unknown-manager',
            } as BranchUpgradeConfig,
          ],
        },
      ];
      const branch = branches[0];
      const managers = [
        ...new Set(
          branch.upgrades
            .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
            .filter(is.string)
        ),
      ].sort();

      const branchFingerprint = fingerprint({
        branch,
        managers,
      });
      repoCache.getCache.mockReturnValueOnce({
        branches: [
          {
            branchName: 'new/some-branch',
            baseBranch: 'base_branch',
            branchFingerprint,
          } as BranchCache,
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.Done,
      });
      git.branchExists.mockReturnValue(true);
      config.repositoryCache = 'enabled';
      expect(await writeUpdates(config, branches)).toBe('done');
      expect(branch.branchFingerprint).toBe(branchFingerprint);
    });

    it('caches same fingerprint when no commit is made', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'new/some-branch',
          baseBranch: 'base_branch',
          manager: 'npm',
          upgrades: [
            {
              manager: 'unknown-manager',
            } as BranchUpgradeConfig,
          ],
        },
      ];
      const branch = branches[0];
      const managers = [
        ...new Set(
          branch.upgrades
            .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
            .filter(is.string)
        ),
      ].sort();
      const branchFingerprint = fingerprint({
        branch,
        managers,
      });
      repoCache.getCache.mockReturnValueOnce({
        branches: [
          {
            branchName: 'new/some-branch',
            baseBranch: 'base_branch',
            branchFingerprint,
          } as BranchCache,
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.Done,
      });
      expect(await writeUpdates(config, branches)).toBe('done');
      expect(branch.branchFingerprint).toBe(branchFingerprint);
    });

    it('creates new branchCache when cache is not enabled', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'new/some-branch',
          baseBranch: 'base_branch',
          manager: 'npm',
          upgrades: [
            {
              manager: 'npm',
            } as BranchUpgradeConfig,
          ],
        },
      ];
      const repoCacheObj = {} as RepoCacheData;
      repoCache.getCache.mockReturnValueOnce(repoCacheObj);
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.NoWork,
      });
      git.getBranchCommit
        .mockReturnValueOnce('sha')
        .mockReturnValueOnce('base_sha');
      git.branchExists.mockReturnValueOnce(true);
      await writeUpdates(config, branches);
      expect(logger.logger.debug).not.toHaveBeenCalledWith(
        'No branch cache found for new/some-branch'
      );
      expect(repoCacheObj).toEqual({
        branches: [
          {
            branchName: 'new/some-branch',
            baseBranch: 'base_branch',
            baseBranchSha: 'base_sha',
            sha: 'sha',
          },
        ],
      });
    });
  });

  describe('canSkipBranchUpdateCheck()', () => {
    let branchCache: BranchCache = {
      branchName: 'branch',
      baseBranch: 'base',
      baseBranchSha: 'base_sha',
      sha: 'sha',
      upgrades: [],
      automerge: false,
      prNo: null,
      parentSha: null,
    };

    it('returns false if no cache', () => {
      branchCache = {
        ...branchCache,
        branchName: 'new/some-branch',
        sha: '111',
      };
      expect(canSkipBranchUpdateCheck(branchCache, '222')).toBe(false);
    });

    it('returns false when fingerprints are not same', () => {
      branchCache = {
        ...branchCache,
        branchName: 'new/some-branch',
        sha: '111',
        branchFingerprint: '211',
      };
      expect(canSkipBranchUpdateCheck(branchCache, '222')).toBe(false);
    });

    it('returns true', () => {
      branchCache = {
        ...branchCache,
        branchName: 'new/some-branch',
        sha: '111',
        branchFingerprint: '222',
      };
      expect(canSkipBranchUpdateCheck(branchCache, '222')).toBe(true);
    });
  });

  describe('syncBranchState()', () => {
    it('creates minimal branch state when cache is not populated', () => {
      const repoCacheObj = {} as RepoCacheData;
      repoCache.getCache.mockReturnValue(repoCacheObj);
      git.getBranchCommit.mockReturnValueOnce('sha');
      git.getBranchCommit.mockReturnValueOnce('base_sha');
      expect(syncBranchState('branch_name', 'base_branch')).toEqual({
        branchName: 'branch_name',
        sha: 'sha',
        baseBranch: 'base_branch',
        baseBranchSha: 'base_sha',
      });
    });

    it('when base branch name is different updates it and invalidates isModified value', () => {
      const repoCacheObj: RepoCacheData = {
        branches: [
          {
            branchName: 'branch_name',
            baseBranch: 'base_branch',
            sha: 'sha',
            baseBranchSha: 'base_sha',
            isModified: true,
            upgrades: [],
            automerge: false,
            prNo: null,
            parentSha: null,
          },
        ],
      };
      repoCache.getCache.mockReturnValue(repoCacheObj);
      git.getBranchCommit.mockReturnValueOnce('sha');
      git.getBranchCommit.mockReturnValueOnce('base_sha');
      expect(syncBranchState('branch_name', 'new_base_branch')).toEqual({
        branchName: 'branch_name',
        sha: 'sha',
        baseBranch: 'new_base_branch',
        baseBranchSha: 'base_sha',
        upgrades: [],
        automerge: false,
        prNo: null,
        parentSha: null,
      });
    });

    it('when base branch sha is different updates it and invalidates related values', () => {
      const repoCacheObj: RepoCacheData = {
        branches: [
          {
            branchName: 'branch_name',
            sha: 'sha',
            baseBranch: 'base_branch',
            baseBranchSha: 'base_sha',
            isBehindBase: true,
            upgrades: [],
            automerge: false,
            prNo: null,
            parentSha: null,
          },
        ],
      };
      repoCache.getCache.mockReturnValue(repoCacheObj);
      git.getBranchCommit.mockReturnValueOnce('sha');
      git.getBranchCommit.mockReturnValueOnce('new_base_sha');
      expect(syncBranchState('branch_name', 'base_branch')).toEqual({
        branchName: 'branch_name',
        sha: 'sha',
        baseBranch: 'base_branch',
        baseBranchSha: 'new_base_sha',
        upgrades: [],
        automerge: false,
        prNo: null,
        parentSha: null,
      });
    });

    it('when branch sha is different updates it and invalidates related values', () => {
      const repoCacheObj: RepoCacheData = {
        branches: [
          {
            branchName: 'branch_name',
            sha: 'sha',
            baseBranch: 'base_branch',
            baseBranchSha: 'base_sha',
            isBehindBase: true,
            isModified: true,
            isConflicted: true,
            branchFingerprint: '123',
            upgrades: [],
            automerge: false,
            prNo: null,
            parentSha: null,
          },
        ],
      };
      repoCache.getCache.mockReturnValue(repoCacheObj);
      git.getBranchCommit.mockReturnValueOnce('new_sha');
      git.getBranchCommit.mockReturnValueOnce('base_sha');
      expect(syncBranchState('branch_name', 'base_branch')).toEqual({
        branchName: 'branch_name',
        sha: 'new_sha',
        baseBranch: 'base_branch',
        baseBranchSha: 'base_sha',
        upgrades: [],
        automerge: false,
        prNo: null,
        parentSha: null,
      });
    });

    it('no change if all parameters are same', () => {
      const repoCacheObj: RepoCacheData = {
        branches: [
          {
            branchName: 'branch_name',
            sha: 'sha',
            baseBranch: 'base_branch',
            baseBranchSha: 'base_sha',
            isBehindBase: true,
            isModified: true,
            isConflicted: true,
            branchFingerprint: '123',
            upgrades: [],
            automerge: false,
            prNo: null,
            parentSha: null,
          },
        ],
      };
      repoCache.getCache.mockReturnValue(repoCacheObj);
      git.getBranchCommit.mockReturnValueOnce('sha');
      git.getBranchCommit.mockReturnValueOnce('base_sha');
      expect(syncBranchState('branch_name', 'base_branch')).toEqual({
        branchName: 'branch_name',
        sha: 'sha',
        baseBranch: 'base_branch',
        baseBranchSha: 'base_sha',
        isBehindBase: true,
        isModified: true,
        isConflicted: true,
        branchFingerprint: '123',
        upgrades: [],
        automerge: false,
        prNo: null,
        parentSha: null,
      });
    });
  });
});
