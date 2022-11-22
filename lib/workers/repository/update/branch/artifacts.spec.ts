import { getConfig, platform } from '../../../../../test/util';
import { GlobalConfig } from '../../../../config/global';
import type { BranchConfig } from '../../../types';
import { setArtifactErrorStatus } from './artifacts';

describe('workers/repository/update/branch/artifacts', () => {
  let config: BranchConfig;

  beforeEach(() => {
    GlobalConfig.set({});
    jest.resetAllMocks();
    // TODO #7154 incompatible types
    config = {
      ...getConfig(),
      manager: 'some-manager',
      branchName: 'renovate/pin',
      upgrades: [],
      artifactErrors: [{ lockFile: 'some' }],
    } as BranchConfig;
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

    it('skips status (dry-run)', async () => {
      GlobalConfig.set({ dryRun: 'full' });
      platform.getBranchStatusCheck.mockResolvedValueOnce(null);
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status (no errors)', async () => {
      platform.getBranchStatusCheck.mockResolvedValueOnce(null);
      config.artifactErrors = [];
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });
  });
});
