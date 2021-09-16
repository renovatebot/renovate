import { getConfig, platform } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import { BranchStatus } from '../../types';
import { BranchConfig } from '../types';
import { setArtifactErrorStatus } from './artifacts';

const config: BranchConfig = {
  ...getConfig(),
  branchName: 'renovate/pin',
  upgrades: [],
};

describe('workers/branch/artifacts', () => {
  beforeEach(() => {
    setGlobalConfig({});
    jest.resetAllMocks();
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
  });
});
