import { partial, platform } from '../../../../../test/util';
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
      config = partial<StabilityConfig>({
        branchName: 'renovate/some-branch',
      });
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('returns if not configured', async () => {
      await setStability(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(0);
    });

    it('sets status yellow', async () => {
      config.stabilityStatus = 'yellow';
      await setStability(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });

    it('sets status green', async () => {
      config.stabilityStatus = 'green';
      await setStability(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });

    it('skips status if already set', async () => {
      config.stabilityStatus = 'green';
      platform.getBranchStatusCheck.mockResolvedValueOnce('green');
      await setStability(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(0);
    });
  });

  describe('setConfidence', () => {
    let config: ConfidenceConfig;

    beforeEach(() => {
      config = {
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
      config.confidenceStatus = 'yellow';
      await setConfidence(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });

    it('sets status green', async () => {
      config.minimumConfidence = 'high';
      config.confidenceStatus = 'green';
      await setConfidence(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(1);
    });

    it('skips status if already set', async () => {
      config.minimumConfidence = 'high';
      config.confidenceStatus = 'green';
      platform.getBranchStatusCheck.mockResolvedValueOnce('green');
      await setConfidence(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(0);
    });
  });

  describe('getBranchStatus', () => {
    it('should return green if ignoreTests=true', async () => {
      expect(await resolveBranchStatus('somebranch', true, true)).toBe('green');
    });
  });
});
