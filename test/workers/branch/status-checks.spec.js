const {
  setUnpublishable,
} = require('../../../lib/workers/branch/status-checks');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

describe('workers/branch/status-checks', () => {
  describe('setUnpublishable', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
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
      platform.getBranchStatusCheck.mockReturnValueOnce('success');
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck).toHaveBeenCalledTimes(1);
      expect(platform.setBranchStatus).toHaveBeenCalledTimes(0);
    });
  });
});
