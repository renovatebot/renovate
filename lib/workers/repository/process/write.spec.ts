import is from '@sindresorhus/is';
import hasha from 'hasha';
import stringify from 'safe-stable-stringify';
import {
  RenovateConfig,
  getConfig,
  git,
  logger,
  mocked,
  partial,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { addMeta } from '../../../logger';
import { hashMap } from '../../../modules/manager';
import * as _repoCache from '../../../util/cache/repository';
import type {
  BranchCache,
  RepoCacheData,
} from '../../../util/cache/repository/types';
import { Limit, isLimitReached } from '../../global/limits';
import { BranchConfig, BranchResult, BranchUpgradeConfig } from '../../types';
import * as _branchWorker from '../update/branch';
import * as _limits from './limits';
import {
  canSkipBranchUpdateCheck,
  syncBranchCache,
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
});

describe('workers/repository/process/write', () => {
  describe('writeUpdates()', () => {
    it('stops after automerge', async () => {
      const branches = partial<BranchConfig[]>([
        { branchName: 'test_branch', manager: 'npm', upgrades: [] },
        { branchName: 'test_branch', manager: 'npm', upgrades: [] },
        {
          branchName: 'test_branch',
          manager: 'npm',
          automergeType: 'pr-comment',
          ignoreTests: true,
          upgrades: [],
        },
        { branchName: 'test_branch', manager: 'npm', upgrades: [] },
        { branchName: 'test_branch', manager: 'npm', upgrades: [] },
      ]);
      repoCache.getCache.mockReturnValue({});
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
        partial<BranchConfig>({ baseBranch: 'main', branchName, upgrades: [] }),
        partial<BranchConfig>({ baseBranch: 'dev', branchName, upgrades: [] }),
      ] as never;
      repoCache.getCache.mockReturnValueOnce({});
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.PrCreated,
      });
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
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

    it('return nowork if same updates', async () => {
      const branches = partial<BranchConfig[]>([
        {
          branchName: 'new/some-branch',
          manager: 'npm',
          upgrades: [
            {
              manager: 'npm',
            } as BranchUpgradeConfig,
          ],
        },
      ]);
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
      git.branchExists.mockReturnValue(true);
      git.getBranchCommit.mockReturnValue('111');
      config.repositoryCache = 'enabled';
      expect(await writeUpdates(config, branches)).toBe('done');
    });

    it('updates branch fingerprint when commit is made', async () => {
      const branches = partial<BranchConfig[]>([
        {
          branchName: 'new/some-branch',
          manager: 'npm',
          upgrades: [
            {
              manager: 'unknown-manager',
            } as BranchUpgradeConfig,
          ],
        },
      ]);
      repoCache.getCache.mockReturnValue({
        branches: [
          {
            branchName: 'new/some-branch',
            branchFingerprint: '222',
          } as BranchCache,
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.Done,
        commitSha: 'some-value',
      });
      git.branchExists.mockReturnValue(true);
      const branchManagersFingerprint = hasha(
        [
          ...new Set(
            branches[0].upgrades
              .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
              .filter(is.string)
          ),
        ].sort()
      );
      const fingerprint = hasha([
        stringify(branches[0]),
        branchManagersFingerprint,
      ]);
      config.repositoryCache = 'enabled';
      expect(await writeUpdates(config, branches)).toBe('done');
      expect(branches[0].branchFingerprint).toBe(fingerprint);
    });

    it('shows debug log when the cache is enabled, but branch cache not found', async () => {
      const branches = partial<BranchConfig[]>([
        {
          branchName: 'new/some-branch',
          manager: 'npm',
          upgrades: [
            {
              manager: 'npm',
            } as BranchUpgradeConfig,
          ],
        },
      ]);
      repoCache.getCache.mockReturnValueOnce({});
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.NoWork,
      });
      git.branchExists.mockReturnValueOnce(true);
      config.repositoryCache = 'enabled';
      await writeUpdates(config, branches);
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Branch cache is being created because it does not exist for new/some-branch'
      );
    });
  });

  describe('canSkipBranchUpdateCheck()', () => {
    let branchCache = {} as BranchCache;

    it('returns false if no cache', () => {
      branchCache = {
        branchName: 'new/some-branch',
        sha: '111',
      } as BranchCache;
      expect(canSkipBranchUpdateCheck(branchCache, '222')).toBe(false);
    });

    it('returns false when fingerprints are not same', () => {
      branchCache = {
        branchName: 'new/some-branch',
        sha: '111',
        branchFingerprint: '211',
      } as BranchCache;
      expect(canSkipBranchUpdateCheck(branchCache, '222')).toBe(false);
    });

    it('returns true', () => {
      branchCache = {
        branchName: 'new/some-branch',
        sha: '111',
        branchFingerprint: '222',
      } as BranchCache;
      expect(canSkipBranchUpdateCheck(branchCache, '222')).toBe(true);
    });
  });

  describe('invalidate cache', () => {
    let repoCacheObj: RepoCacheData = {};

    beforeEach(() => {
      repoCacheObj = {
        branches: [
          {
            branchName: 'new/some-branch',
            sha: '111',
            isModified: false,
            isConflicted: false,
            isBehindBaseBranch: false,
            baseBranchSha: '333',
            baseBranchName: 'base_branch',
            parentSha: '222',
          } as BranchCache,
        ],
      } as RepoCacheData;
      repoCache.getCache.mockReturnValue(repoCacheObj);
    });

    it('removes cached values when both baseBranchSha and branchSha change', async () => {
      const branches = partial<BranchConfig[]>([
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
      ]);
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.Done,
      });
      git.branchExists.mockReturnValue(true);
      git.getBranchCommit.mockReturnValueOnce('101');
      git.getBranchCommit.mockReturnValueOnce('303');
      config.repositoryCache = 'enabled';
      await writeUpdates(config, branches);
      expect(repoCacheObj).toEqual({
        branches: [
          {
            branchName: 'new/some-branch',
            sha: '101',
            baseBranchSha: '303',
            baseBranchName: 'base_branch',
            parentSha: '222',
          },
        ],
      });
    });

    it('no invalidation if SHa are same', async () => {
      const branches = partial<BranchConfig[]>([
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
      ]);
      const branchCache = {
        sha: '101',
        baseBranchSha: '303',
        baseBranchName: 'base_branch',
        branchName: 'new/some-branch',
      } as BranchCache;
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.Done,
        commitSha: 'some-value',
      });
      git.branchExists.mockReturnValue(false);
      git.getBranchCommit.mockReturnValueOnce('101');
      git.getBranchCommit.mockReturnValueOnce('303');
      config.repositoryCache = 'enabled';
      await writeUpdates(config, branches);
      repoCache.getCache.mockReturnValueOnce({ branches: [branchCache] });
      expect(branchCache).toEqual({
        sha: '101',
        baseBranchSha: '303',
        baseBranchName: 'base_branch',
        branchName: 'new/some-branch',
      });
    });

    it('creates branch cache with false values on first run', async () => {
      const branches = partial<BranchConfig[]>([
        {
          branchName: 'new/some-branch',
          manager: 'npm',
          upgrades: [
            {
              manager: 'unknown-manager',
            } as BranchUpgradeConfig,
          ],
        },
      ]);
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.Done,
        commitSha: 'some-value',
      });
      git.branchExists.mockReturnValue(false);
      git.getBranchCommit.mockReturnValueOnce('101');
      git.getBranchCommit.mockReturnValueOnce('303');
      config.repositoryCache = 'enabled';
      const branchManagersFingerprint = hasha(
        [
          ...new Set(
            branches[0].upgrades
              .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
              .filter(is.string)
          ),
        ].sort()
      );
      const fingerprint = hasha([
        stringify(branches[0]),
        branchManagersFingerprint,
      ]);
      await writeUpdates(config, branches);
      repoCache.getCache.mockReturnValueOnce({});
      expect(repoCacheObj).toEqual({
        branches: [
          {
            branchName: 'new/some-branch',
            sha: 'some-value',
            isModified: false,
            isConflicted: false,
            isBehindBaseBranch: false,
            baseBranchSha: '303',
            baseBranchName: 'base_branch',
            parentSha: '303',
            branchFingerprint: fingerprint,
          } as BranchCache,
        ],
      });
    });

    it('adds cache when branch exists but cache not found', async () => {
      const branches = partial<BranchConfig[]>([
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
      ]);
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.Done,
        commitSha: 'some-value',
      });
      git.branchExists.mockReturnValue(true);
      git.getBranchCommit.mockReturnValueOnce('101');
      git.getBranchCommit.mockReturnValueOnce('303');
      config.repositoryCache = 'enabled';
      const branchManagersFingerprint = hasha(
        [
          ...new Set(
            branches[0].upgrades
              .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
              .filter(is.string)
          ),
        ].sort()
      );
      const fingerprint = hasha([
        stringify(branches[0]),
        branchManagersFingerprint,
      ]);
      repoCache.getCache.mockReturnValueOnce(repoCacheObj);
      await writeUpdates(config, branches);
      expect(repoCacheObj).toEqual({
        branches: [
          {
            branchName: 'new/some-branch',
            sha: 'some-value',
            isModified: false,
            isConflicted: false,
            isBehindBaseBranch: false,
            baseBranchSha: '303',
            baseBranchName: 'base_branch',
            parentSha: '303',
            branchFingerprint: fingerprint,
          } as BranchCache,
        ],
      });
    });

    it('invalidates cache when baseBranchName differs', () => {
      const branchCache = {
        branchName: 'some-branch',
        baseBranchName: 'old-base-branch-name',
        sha: 'sha',
        baseBranchSha: 'base-sha',
        isModified: true,
      } as BranchCache;
      repoCache.getCache.mockReturnValueOnce({
        branches: [branchCache],
      });

      syncBranchCache(
        'some-branch',
        'sha',
        'new-base-branch-name',
        'new-base-sha',
        branchCache
      );
      expect(branchCache).toEqual({
        branchName: 'some-branch',
        baseBranchName: 'new-base-branch-name',
        sha: 'sha',
        baseBranchSha: 'new-base-sha',
      });
    });
  });
});
