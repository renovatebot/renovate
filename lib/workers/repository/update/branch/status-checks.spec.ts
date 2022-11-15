import { getConfig, platform } from '../../../../../test/util';
import { BranchStatus } from '../../../../types';
import {
  ConfidenceConfig,
  StabilityConfig,
  resolveBranchStatus,
  setConfidence,
  setStability,
} from './status-checks';

describe('workers/repository/update/branch/status-checks', () => {
  describe('setStability', () => {
    let config: StabilityConfig;

    beforeEach(() => {
      config = {
        ...getConfig(),
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

  describe('setConfidence', () => {
    let config: ConfidenceConfig;

    beforeEach(() => {
      config = {
        ...getConfig(),
        branchName: 'renovate/some-branch',
      };
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('returns if not configured', async () => {
      await setConfidence(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(0);
    });

    it('sets status yellow', async () => {
      config.minimumConfidence = 'high';
      config.confidenceStatus = BranchStatus.yellow;
      await setConfidence(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });

    it('sets status green', async () => {
      config.minimumConfidence = 'high';
      config.confidenceStatus = BranchStatus.green;
      await setConfidence(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });

    it('skips status if already set', async () => {
      config.minimumConfidence = 'high';
      config.confidenceStatus = BranchStatus.green;
      platform.getBranchStatusCheck.mockResolvedValueOnce(BranchStatus.green);
      await setConfidence(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(0);
    });
  });

  describe('getBranchStatus', () => {
    it('should return green if ignoreTests=true', async () => {
      expect(await resolveBranchStatus('somebranch', true)).toBe(
        BranchStatus.green
      );
    });
  });
});
