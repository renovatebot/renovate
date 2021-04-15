import {
  RenovateConfig,
  getConfig,
  getName,
  git,
  mocked,
} from '../../../../test/util';
import * as _branchWorker from '../../branch';
import { Limit, isLimitReached } from '../../global/limits';
import { BranchConfig, BranchResult } from '../../types';
import * as _limits from './limits';
import { writeUpdates } from './write';

jest.mock('../../../util/git');

const branchWorker = mocked(_branchWorker);
const limits = mocked(_limits);

branchWorker.processBranch = jest.fn();

limits.getPrsRemaining = jest.fn().mockResolvedValue(99);
limits.getBranchesRemaining = jest.fn().mockReturnValue(99);

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe(getName(__filename), () => {
  describe('writeUpdates()', () => {
    it('skips branches blocked by pin', async () => {
      const branches: BranchConfig[] = [
        { updateType: 'pin' },
        { blockedByPin: true },
        {},
      ] as never;
      git.branchExists.mockReturnValueOnce(false);
      const res = await writeUpdates(config, branches);
      expect(res).toEqual('done');
      expect(branchWorker.processBranch).toHaveBeenCalledTimes(2);
    });
    it('stops after automerge', async () => {
      const branches: BranchConfig[] = [
        {},
        {},
        { automergeType: 'pr-comment', requiredStatusChecks: null },
        {},
        {},
      ] as never;
      git.branchExists.mockReturnValue(true);
      branchWorker.processBranch.mockResolvedValueOnce(BranchResult.PrCreated);
      branchWorker.processBranch.mockResolvedValueOnce(
        BranchResult.AlreadyExisted
      );
      branchWorker.processBranch.mockResolvedValueOnce(BranchResult.Automerged);
      branchWorker.processBranch.mockResolvedValueOnce(BranchResult.Automerged);
      const res = await writeUpdates(config, branches);
      expect(res).toEqual('automerged');
      expect(branchWorker.processBranch).toHaveBeenCalledTimes(4);
    });
    it('increments branch counter', async () => {
      const branches: BranchConfig[] = [{}] as never;
      branchWorker.processBranch.mockResolvedValueOnce(BranchResult.PrCreated);
      git.branchExists.mockReturnValueOnce(false);
      git.branchExists.mockReturnValueOnce(true);
      limits.getBranchesRemaining.mockReturnValueOnce(1);
      expect(isLimitReached(Limit.Branches)).toBeFalse();
      await writeUpdates({ config }, branches);
      expect(isLimitReached(Limit.Branches)).toBeTrue();
    });
  });
});
