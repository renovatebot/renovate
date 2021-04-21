import { defaultConfig, getName, platform } from '../../../test/util';
import { BranchStatus } from '../../types';
import { StabilityConfig, setStability } from './status-checks';

describe(getName(__filename), () => {
  describe('setStability', () => {
    let config: StabilityConfig;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        branchName: 'renovate/some-branch',
      };
    });
    afterEach(() => {
      jest.resetAllMocks();
    });
    it('returns if not configured', async () => {
      await setStability(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(0);
    });
    it('sets status yellow', async () => {
      config.stabilityStatus = BranchStatus.yellow;
      await setStability(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });
    it('sets status green', async () => {
      config.stabilityStatus = BranchStatus.green;
      await setStability(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });
    it('skips status if already set', async () => {
      config.stabilityStatus = BranchStatus.green;
      platform.getBranchStatusCheck.mockResolvedValueOnce(BranchStatus.green);
      await setStability(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(0);
    });
  });
});
