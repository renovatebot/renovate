import { prAlreadyExisted } from '../../../lib/workers/branch/check-existing';
import { defaultConfig, platform, partial } from '../../util';
import { BranchConfig } from '../../../lib/workers/common';
import { PR_STATE_CLOSED } from '../../../lib/constants/pull-requests';

describe('workers/branch/check-existing', () => {
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
        state: PR_STATE_CLOSED,
      } as never);
      expect(await prAlreadyExisted(config)).toEqual({ number: 12 });
      expect(platform.findPr).toHaveBeenCalledTimes(1);
    });
  });
});
