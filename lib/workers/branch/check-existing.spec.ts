import { defaultConfig, partial, platform } from '../../../test/util';
import { PrState } from '../../types';
import { BranchConfigCoerced } from '../common';
import { prAlreadyExisted } from './check-existing';

describe('workers/branch/check-existing', () => {
  describe('prAlreadyExisted', () => {
    let config: BranchConfigCoerced;
    beforeEach(() => {
      config = partial<BranchConfigCoerced>({
        ...defaultConfig,
        branchName: 'some-branch',
        prTitle: 'some-title',
        recreateClosed: null,
      });
      jest.resetAllMocks();
    });
    it('returns false if recreating closed PRs', async () => {
      config.recreateClosed = true;
      expect(await prAlreadyExisted(config)).toBeNull();
      expect(platform.findPr).toHaveBeenCalledTimes(0);
    });
    it('returns false if check misses', async () => {
      config.recreatedClosed = true;
      expect(await prAlreadyExisted(config)).toBeNull();
      expect(platform.findPr).toHaveBeenCalledTimes(1);
    });
    it('returns true if first check hits', async () => {
      platform.findPr.mockResolvedValueOnce({ number: 12 } as never);
      platform.getPr.mockResolvedValueOnce({
        number: 12,
        state: PrState.Closed,
      } as never);
      expect(await prAlreadyExisted(config)).toEqual({ number: 12 });
      expect(platform.findPr).toHaveBeenCalledTimes(1);
    });
  });
});
