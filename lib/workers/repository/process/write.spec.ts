import is from '@sindresorhus/is';
import hasha from 'hasha';
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
import type { BranchCache } from '../../../util/cache/repository/types';
import { Limit, isLimitReached } from '../../global/limits';
import { BranchConfig, BranchResult, BranchUpgradeConfig } from '../../types';
import * as _branchWorker from '../update/branch';
import * as _limits from './limits';
import { canSkipBranchUpdateCheck, writeUpdates } from './write';

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
        JSON.stringify(branches[0]),
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
        'No branch cache found for new/some-branch'
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
});
