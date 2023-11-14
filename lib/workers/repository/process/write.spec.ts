import is from '@sindresorhus/is';
import {
  RenovateConfig,
  logger,
  mocked,
  partial,
  scm,
} from '../../../../test/util';
import { getConfig } from '../../../config/defaults';
import { GlobalConfig } from '../../../config/global';
import { addMeta } from '../../../logger';
import { hashMap } from '../../../modules/manager';
import * as _repoCache from '../../../util/cache/repository';
import type {
  BranchCache,
  RepoCacheData,
} from '../../../util/cache/repository/types';
import { fingerprint } from '../../../util/fingerprint';
import { isLimitReached } from '../../global/limits';
import type { BranchConfig, BranchUpgradeConfig } from '../../types';
import * as _branchWorker from '../update/branch';
import * as _limits from './limits';
import {
  canSkipBranchUpdateCheck,
  generateCommitFingerprintConfig,
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
      scm.branchExists.mockResolvedValue(true);
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: 'pr-created',
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: false,
        result: 'already-existed',
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: false,
        result: 'automerged',
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: false,
        result: 'automerged',
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
        result: 'pr-created',
      });
      scm.branchExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      limits.getBranchesRemaining.mockResolvedValueOnce(1);
      expect(isLimitReached('Branches')).toBeFalse();
      GlobalConfig.set({ dryRun: 'full' });
      config.baseBranches = ['main', 'dev'];
      await writeUpdates(config, branches);
      expect(isLimitReached('Branches')).toBeTrue();
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
            partial<BranchUpgradeConfig>({
              manager: 'npm',
            }),
          ],
        },
      ];
      repoCache.getCache.mockReturnValueOnce({
        branches: [
          partial<BranchCache>({
            branchName: 'new/some-branch',
            sha: '111',
            commitFingerprint: '111',
          }),
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: 'no-work',
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
            partial<BranchUpgradeConfig>({
              manager: 'unknown-manager',
            }),
          ],
        },
      ];
      repoCache.getCache.mockReturnValueOnce({
        branches: [
          partial<BranchCache>({
            branchName: 'new/some-branch',
            commitFingerprint: '222',
          }),
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        updatesVerified: true,
        result: 'done',
        commitSha: 'some-value',
      });
      const branch = branches[0];
      const managers = [
        ...new Set(
          branch.upgrades
            .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
            .filter(is.string),
        ),
      ].sort();
      const commitFingerprint = fingerprint({
        commitFingerprintConfig: generateCommitFingerprintConfig(branch),
        managers,
      });
      expect(await writeUpdates(config, branches)).toBe('done');
      expect(branch.commitFingerprint).toBe(commitFingerprint);
    });

    it('caches same fingerprint when no commit is made and branch cache existed', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'new/some-branch',
          baseBranch: 'base_branch',
          manager: 'npm',
          upgrades: [
            partial<BranchUpgradeConfig>({
              manager: 'unknown-manager',
            }),
          ],
        },
      ];
      const branch = branches[0];
      const managers = [
        ...new Set(
          branch.upgrades
            .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
            .filter(is.string),
        ),
      ].sort();

      const commitFingerprint = fingerprint({
        branch,
        managers,
      });
      repoCache.getCache.mockReturnValueOnce({
        branches: [
          partial<BranchCache>({
            branchName: 'new/some-branch',
            baseBranch: 'base_branch',
            commitFingerprint,
          }),
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: 'done',
      });
      scm.branchExists.mockResolvedValue(true);
      config.repositoryCache = 'enabled';
      expect(await writeUpdates(config, branches)).toBe('done');
      expect(branch.commitFingerprint).toBe(commitFingerprint);
    });

    it('caches same fingerprint when no commit is made', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'new/some-branch',
          baseBranch: 'base_branch',
          manager: 'npm',
          upgrades: [
            partial<BranchUpgradeConfig>({
              manager: 'unknown-manager',
            }),
          ],
        },
      ];
      const branch = branches[0];
      const managers = [
        ...new Set(
          branch.upgrades
            .map((upgrade) => hashMap.get(upgrade.manager) ?? upgrade.manager)
            .filter(is.string),
        ),
      ].sort();
      const commitFingerprint = fingerprint({
        branch,
        managers,
      });
      repoCache.getCache.mockReturnValueOnce({
        branches: [
          partial<BranchCache>({
            branchName: 'new/some-branch',
            baseBranch: 'base_branch',
            commitFingerprint,
          }),
        ],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: 'done',
      });
      expect(await writeUpdates(config, branches)).toBe('done');
      expect(branch.commitFingerprint).toBe(commitFingerprint);
    });

    it('creates new branchCache when cache is not enabled', async () => {
      const branches: BranchConfig[] = [
        {
          branchName: 'new/some-branch',
          baseBranch: 'base_branch',
          manager: 'npm',
          upgrades: [
            partial<BranchUpgradeConfig>({
              manager: 'npm',
            }),
          ],
        },
      ];
      const repoCacheObj = partial<RepoCacheData>();
      repoCache.getCache.mockReturnValueOnce(repoCacheObj);
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: 'no-work',
      });
      scm.getBranchCommit
        .mockResolvedValueOnce('sha')
        .mockResolvedValueOnce('base_sha');
      scm.branchExists.mockResolvedValueOnce(true);
      await writeUpdates(config, branches);
      expect(logger.logger.debug).not.toHaveBeenCalledWith(
        'No branch cache found for new/some-branch',
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
        commitFingerprint: '211',
      };
      expect(canSkipBranchUpdateCheck(branchCache, '222')).toBe(false);
    });

    it('returns true', () => {
      branchCache = {
        ...branchCache,
        branchName: 'new/some-branch',
        sha: '111',
        commitFingerprint: '222',
      };
      expect(canSkipBranchUpdateCheck(branchCache, '222')).toBe(true);
    });
  });

  describe('syncBranchState()', () => {
    it('creates minimal branch state when cache is not populated', () => {
      const repoCacheObj = partial<RepoCacheData>();
      repoCache.getCache.mockReturnValue(repoCacheObj);
      scm.getBranchCommit.mockResolvedValueOnce('sha');
      scm.getBranchCommit.mockResolvedValueOnce('base_sha');
      return expect(
        syncBranchState('branch_name', 'base_branch'),
      ).resolves.toEqual({
        branchName: 'branch_name',
        sha: 'sha',
        baseBranch: 'base_branch',
        baseBranchSha: 'base_sha',
      });
    });

    it('when base branch name is different updates it and invalidates related cache', () => {
      const repoCacheObj: RepoCacheData = {
        branches: [
          {
            branchName: 'branch_name',
            baseBranch: 'base_branch',
            sha: 'sha',
            baseBranchSha: 'base_sha',
            isModified: true,
            pristine: false,
            upgrades: [],
            automerge: false,
            prNo: null,
          },
        ],
      };
      repoCache.getCache.mockReturnValue(repoCacheObj);
      scm.getBranchCommit.mockResolvedValueOnce('sha');
      scm.getBranchCommit.mockResolvedValueOnce('base_sha');
      return expect(
        syncBranchState('branch_name', 'new_base_branch'),
      ).resolves.toEqual({
        branchName: 'branch_name',
        sha: 'sha',
        baseBranch: 'new_base_branch',
        baseBranchSha: 'base_sha',
        pristine: false,
        upgrades: [],
        automerge: false,
        prNo: null,
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
            pristine: false,
            upgrades: [],
            automerge: false,
            prNo: null,
          },
        ],
      };
      repoCache.getCache.mockReturnValue(repoCacheObj);
      scm.getBranchCommit.mockResolvedValueOnce('sha');
      scm.getBranchCommit.mockResolvedValueOnce('new_base_sha');
      return expect(
        syncBranchState('branch_name', 'base_branch'),
      ).resolves.toEqual({
        branchName: 'branch_name',
        sha: 'sha',
        baseBranch: 'base_branch',
        baseBranchSha: 'new_base_sha',
        upgrades: [],
        pristine: false,
        automerge: false,
        prNo: null,
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
            pristine: true,
            isConflicted: true,
            commitFingerprint: '123',
            upgrades: [],
            automerge: false,
            prNo: null,
          },
        ],
      };
      repoCache.getCache.mockReturnValue(repoCacheObj);
      scm.getBranchCommit.mockResolvedValueOnce('new_sha');
      scm.getBranchCommit.mockResolvedValueOnce('base_sha');
      return expect(
        syncBranchState('branch_name', 'base_branch'),
      ).resolves.toEqual({
        branchName: 'branch_name',
        sha: 'new_sha',
        baseBranch: 'base_branch',
        baseBranchSha: 'base_sha',
        upgrades: [],
        pristine: false,
        automerge: false,
        prNo: null,
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
            commitFingerprint: '123',
            upgrades: [],
            automerge: false,
            prNo: null,
            pristine: true,
          },
        ],
      };
      repoCache.getCache.mockReturnValue(repoCacheObj);
      scm.getBranchCommit.mockResolvedValueOnce('sha');
      scm.getBranchCommit.mockResolvedValueOnce('base_sha');
      return expect(
        syncBranchState('branch_name', 'base_branch'),
      ).resolves.toEqual({
        branchName: 'branch_name',
        sha: 'sha',
        baseBranch: 'base_branch',
        baseBranchSha: 'base_sha',
        isBehindBase: true,
        isModified: true,
        isConflicted: true,
        commitFingerprint: '123',
        upgrades: [],
        automerge: false,
        prNo: null,
        pristine: true,
      });
    });
  });
});
