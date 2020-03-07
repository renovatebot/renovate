import { writeUpdates } from './write';
import * as _branchWorker from '../../branch';
import * as _limits from './limits';
import { mocked, getConfig, RenovateConfig } from '../../../../test/util';
import { BranchConfig } from '../../common';

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
    const packageFiles = {};
    it('skips branches blocked by pin', async () => {
      const branches: BranchConfig[] = [
        { updateType: 'pin' },
        { blockedByPin: true },
        {},
      ] as never;
      const res = await writeUpdates(config, packageFiles, branches);
      expect(res).toEqual('done');
      expect(branchWorker.processBranch).toHaveBeenCalledTimes(2);
    });
    it('stops after automerge', async () => {
      const branches: BranchConfig[] = [{}, {}, {}, {}] as never;
      branchWorker.processBranch.mockResolvedValueOnce('pr-created');
      branchWorker.processBranch.mockResolvedValueOnce('already-existed');
      branchWorker.processBranch.mockResolvedValueOnce('automerged');
      const res = await writeUpdates(config, packageFiles, branches);
      expect(res).toEqual('automerged');
      expect(branchWorker.processBranch).toHaveBeenCalledTimes(3);
    });
  });
});
