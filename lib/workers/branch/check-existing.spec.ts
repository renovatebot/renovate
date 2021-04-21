import { defaultConfig, getName, partial, platform } from '../../../test/util';
import { PrState } from '../../types';
import type { BranchConfig } from '../types';
import { prAlreadyExisted } from './check-existing';

describe(getName(__filename), () => {
  describe('prAlreadyExisted', () => {
    let config: BranchConfig;
    beforeEach(() => {
      config = partial<BranchConfig>({
        ...defaultConfig,
        branchName: 'some-branch',
        prTitle: 'some-title',
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
