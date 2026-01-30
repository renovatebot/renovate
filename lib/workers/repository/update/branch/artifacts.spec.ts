import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import type { BranchConfig } from '../../../types.ts';
import { setArtifactErrorStatus } from './artifacts.ts';
import { partial, platform } from '~test/util.ts';
import type { RenovateConfig } from '~test/util.ts';

describe('workers/repository/update/branch/artifacts', () => {
  let config: BranchConfig;

  beforeEach(() => {
    GlobalConfig.set({});
    config = {
      baseBranch: 'base-branch',
      manager: 'some-manager',
      branchName: 'renovate/pin',
      upgrades: [],
      artifactErrors: [{ lockFile: 'some' }],
      statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
        artifactError: 'renovate/artifact',
      }),
    } satisfies BranchConfig;
  });

  describe('setArtifactsErrorStatus', () => {
    it('adds status', async () => {
      platform.getBranchStatusCheck.mockResolvedValueOnce(null);
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).toHaveBeenCalled();
    });

    it('skips status', async () => {
      platform.getBranchStatusCheck.mockResolvedValueOnce('red');
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames.artifactError is null', async () => {
      await setArtifactErrorStatus({
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          artifactError: null,
        }),
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames.artifactError is empty string', async () => {
      await setArtifactErrorStatus({
        ...config,
        statusCheckNames: partial<RenovateConfig['statusCheckNames']>({
          artifactError: '',
        }),
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status if statusCheckNames is undefined', async () => {
      await setArtifactErrorStatus({
        ...config,
        statusCheckNames: undefined,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Status check is null or an empty string, skipping status check addition.',
      );
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status (dry-run)', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status (no errors)', async () => {
      config.artifactErrors = [];
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });
  });
});
