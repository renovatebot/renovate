import type { RenovateConfig } from '../../../../../test/util';
import { partial, platform } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import type { BranchConfig } from '../../../types';
import { setArtifactErrorStatus } from './artifacts';

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
