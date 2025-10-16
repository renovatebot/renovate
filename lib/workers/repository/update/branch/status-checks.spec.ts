import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { ConfidenceConfig, StabilityConfig } from './status-checks';
import {
  resolveBranchStatus,
  setConfidence,
  setStability,
} from './status-checks';
import { partial, platform } from '~test/util';
import type { RenovateConfig } from '~test/util';

describe('workers/repository/update/branch/status-checks', () => {
  describe('setStability', () => {
    let config: StabilityConfig;

    beforeEach(() => {
      config = partial<StabilityConfig>({
        branchName: 'renovate/some-branch',
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          minimumReleaseAge: 'renovate/stability-days',
        }),
      });
      GlobalConfig.reset();
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

    it('skips status if statusCheckNames.minimumReleaseAge is null', async () => {
      config.stabilityStatus = 'green';
      await setStability({
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          minimumReleaseAge: null,
        }),
      });
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames.minimumReleaseAge is empty string', async () => {
      config.stabilityStatus = 'green';
      await setStability({
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          minimumReleaseAge: '',
        }),
      });
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames is undefined', async () => {
      config.stabilityStatus = 'green';
      await setStability({
        ...config,
        statusCheckNames: undefined as never,
      });
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('does not set status in dry mode', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      config.stabilityStatus = 'green';
      await setStability(config);
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would update renovate/stability-days status check state to green',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });
  });

  describe('setConfidence', () => {
    let config: ConfidenceConfig;

    beforeEach(() => {
      config = {
        branchName: 'renovate/some-branch',
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          mergeConfidence: 'renovate/merge-confidence',
        }),
      };
      GlobalConfig.reset();
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

    it('skips status if statusCheckNames.mergeConfidence is null', async () => {
      config.minimumConfidence = 'high';
      config.confidenceStatus = 'green';
      await setConfidence({
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          mergeConfidence: null,
        }),
      });
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames.mergeConfidence is empty string', async () => {
      config.minimumConfidence = 'high';
      config.confidenceStatus = 'green';
      await setConfidence({
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          mergeConfidence: '',
        }),
      });
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames is undefined', async () => {
      config.minimumConfidence = 'high';
      config.confidenceStatus = 'green';
      await setConfidence({
        ...config,
        statusCheckNames: undefined as never,
      });
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('does not set status in dry mode', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      config.minimumConfidence = 'high';
      config.confidenceStatus = 'yellow';
      await setConfidence(config);
      // eslint-disable-next-line vitest/prefer-called-exactly-once-with
      expect(logger.info).toHaveBeenCalledWith(
        'DRY-RUN: Would update renovate/merge-confidence status check state to yellow',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });
  });

  describe('getBranchStatus', () => {
    it('should return green if ignoreTests=true', async () => {
      expect(await resolveBranchStatus('somebranch', true, true)).toBe('green');
    });
  });
});
