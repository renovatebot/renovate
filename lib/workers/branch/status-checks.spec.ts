import { defaultConfig, platform } from '../../../test/util';
import { BranchStatus } from '../../types';
import {
  StabilityConfig,
  UnpublishableConfig,
  setStability,
  setUnpublishable,
} from './status-checks';

describe('workers/branch/status-checks', () => {
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
  });
  describe('setUnpublishable', () => {
    let config: UnpublishableConfig;
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
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(0);
    });
    it('defaults to canBeUnpublished', async () => {
      config.unpublishSafe = true;
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });
    it('finds canBeUnpublished false and sets status', async () => {
      config.canBeUnpublished = true;
      config.unpublishSafe = true;
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });
    it('finds canBeUnpublished false and skips status', async () => {
      config.unpublishSafe = true;
      config.canBeUnpublished = false;
      platform.getBranchStatusCheck.mockResolvedValueOnce(BranchStatus.green);
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(0);
    });
  });
});
