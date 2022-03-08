import { RenovateConfig, getConfig, git, mocked } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { branchExists } from '../../../util/git';
import { Limit, isLimitReached } from '../../global/limits';
import { BranchConfig, BranchResult } from '../../types';
import * as _branchWorker from '../update/branch';
import { processBranch } from '../update/branch';
import * as _limits from './limits';
import { writeUpdates } from './write';

jest.mock('../../../util/git');

const branchWorker = mocked(_branchWorker);
const limits = mocked(_limits);

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
      const branches: BranchConfig[] = [
        {},
        {},
        { automergeType: 'pr-comment', ignoreTests: true },
        {},
        {},
      ] as never;
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
      const branches: BranchConfig[] = [{}] as never;
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
    it('dryRun extract no branch', async () => {
      const branches: BranchConfig[] = [{}] as never;
      limits.getBranchesRemaining.mockResolvedValueOnce(0);
      GlobalConfig.set({ dryRun: 'extract' });
      await writeUpdates({ config }, branches);
      expect(branchExists).toHaveBeenCalledTimes(1);
      expect(processBranch).toHaveBeenCalledTimes(0);
    });
    it('dryRun lookup no branch', async () => {
      const branches: BranchConfig[] = [{}] as never;
      limits.getBranchesRemaining.mockResolvedValueOnce(0);
      GlobalConfig.set({ dryRun: 'lookup' });
      await writeUpdates({ config }, branches);
      expect(branchExists).toHaveBeenCalledTimes(1);
      expect(processBranch).toHaveBeenCalledTimes(0);
    });
  });
});
