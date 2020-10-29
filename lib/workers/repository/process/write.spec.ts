import { RenovateConfig, getConfig, git, mocked } from '../../../../test/util';
import * as _branchWorker from '../../branch';
import { BranchConfig, ProcessBranchResult } from '../../common';
import * as _limits from './limits';
import { writeUpdates } from './write';

jest.mock('../../../util/git');

const branchWorker = mocked(_branchWorker);
const limits = mocked(_limits);

branchWorker.processBranch = jest.fn();

limits.getPrsRemaining = jest.fn().mockResolvedValue(99);

let config: RenovateConfig;
beforeEach(() => {
  jest.resetAllMocks();
  config = getConfig();
});

describe('workers/repository/write', () => {
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
      branchWorker.processBranch.mockResolvedValueOnce(
        ProcessBranchResult.PrCreated
      );
      branchWorker.processBranch.mockResolvedValueOnce(
        ProcessBranchResult.AlreadyExisted
      );
      branchWorker.processBranch.mockResolvedValueOnce(
        ProcessBranchResult.Automerged
      );
      branchWorker.processBranch.mockResolvedValueOnce(
        ProcessBranchResult.Automerged
      );
      const res = await writeUpdates(config, branches);
      expect(res).toEqual('automerged');
      expect(branchWorker.processBranch).toHaveBeenCalledTimes(4);
    });
    it('counts created branches', async () => {
      const branches: BranchConfig[] = [
        { res: ProcessBranchResult.Pending, expect: false },
        { res: ProcessBranchResult.PrLimitReached, expect: true },
      ] as never;
      limits.getPrsRemaining.mockResolvedValueOnce(1);

      branches.forEach(({ res, expect: limitReached }) => {
        branchWorker.processBranch.mockResolvedValueOnce(res);
        git.branchExists.mockReturnValueOnce(false);
        git.branchExists.mockReturnValueOnce(!limitReached as never);
      });

      await writeUpdates(config, branches);

      branches.forEach((branch) =>
        expect(branchWorker.processBranch).toHaveBeenCalledWith(
          branch,
          branch.expect,
          false
        )
      );
    });
  });
});
