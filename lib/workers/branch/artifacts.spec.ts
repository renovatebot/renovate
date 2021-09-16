import { getConfig, platform } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import { BranchStatus } from '../../types';
import { BranchConfig } from '../types';
import { setArtifactErrorStatus } from './artifacts';

describe('workers/branch/artifacts', () => {
  let config: BranchConfig;
  beforeEach(() => {
    setGlobalConfig({});
    jest.resetAllMocks();
    config = {
      ...getConfig(),
      branchName: 'renovate/pin',
      upgrades: [],
      artifactErrors: [{ lockFile: 'some' }],
    };
  });

  describe('setArtifactsErrorStatus', () => {
    it('adds status', async () => {
      platform.getBranchStatusCheck.mockResolvedValueOnce(null);
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).toHaveBeenCalled();
    });

    it('skips status', async () => {
      platform.getBranchStatusCheck.mockResolvedValueOnce(BranchStatus.red);
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status (dry-run)', async () => {
      setGlobalConfig({ dryRun: true });
      platform.getBranchStatusCheck.mockResolvedValueOnce(null);
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });

    it('skips status (no errors)', async () => {
      platform.getBranchStatusCheck.mockResolvedValueOnce(null);
      config.artifactErrors.length = 0;
      await setArtifactErrorStatus(config);
      expect(platform.setBranchStatus).not.toHaveBeenCalled();
    });
  });
});
