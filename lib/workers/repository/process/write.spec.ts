import {
  RenovateConfig,
  getConfig,
  git,
  mocked,
  partial,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import * as _repoCache from '../../../util/cache/repository';
import type { BranchCache } from '../../../util/cache/repository/types';
import { Limit, isLimitReached } from '../../global/limits';
import { BranchConfig, BranchResult, BranchUpgradeConfig } from '../../types';
import * as _branchWorker from '../update/branch';
import * as _limits from './limits';
import { writeUpdates } from './write';

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
      const branches = partial<BranchConfig[]>([
        { branchName: 'test_branch', manager: 'npm', upgrades: [] },
      ]);
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
      await writeUpdates({ config }, branches);
      expect(isLimitReached(Limit.Branches)).toBeTrue();
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
        branches: [{ branchName: 'new/some-branch' } as BranchCache],
      });
      branchWorker.processBranch.mockResolvedValueOnce({
        branchExists: true,
        result: BranchResult.NoWork,
      });
      git.branchExists.mockReturnValue(true);
      expect(await writeUpdates({ config }, branches)).toBe('done');
    });
  });
});
