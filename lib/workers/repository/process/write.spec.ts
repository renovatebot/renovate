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
    it('stops after automerge', async () => {
      const branches: BranchConfig[] = [
        {},
        {},
        { automergeType: 'pr-comment', requiredStatusChecks: null },
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
      const res = await writeUpdates(config, branches);
      expect(res).toEqual('automerged');
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
      limits.getBranchesRemaining.mockReturnValueOnce(1);
      expect(isLimitReached(Limit.Branches)).toBeFalse();
      await writeUpdates({ config }, branches);
      expect(isLimitReached(Limit.Branches)).toBeTrue();
    });
  });
});
