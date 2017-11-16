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
        upgrades: [],
      };
    });
    afterEach(() => {
      jest.resetAllMocks();
    });
    it('returns if not configured', async () => {
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck.mock.calls.length).toBe(0);
    });
    it('defaults to unpublishable', async () => {
      config.unpublishSafe = true;
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck.mock.calls.length).toBe(1);
      expect(platform.setBranchStatus.mock.calls.length).toBe(1);
    });
    it('finds unpublishable false and sets status', async () => {
      config.unpublishSafe = true;
      config.upgrades = [{ unpublishable: true }, { unpublishable: false }];
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck.mock.calls.length).toBe(1);
      expect(platform.setBranchStatus.mock.calls.length).toBe(1);
    });
    it('finds unpublishable false and skips status', async () => {
      config.unpublishSafe = true;
      config.upgrades = [{ unpublishable: true }, { unpublishable: false }];
      platform.getBranchStatusCheck.mockReturnValueOnce('pending');
      await setUnpublishable(config);
      expect(platform.getBranchStatusCheck.mock.calls.length).toBe(1);
      expect(platform.setBranchStatus.mock.calls.length).toBe(0);
    });
  });
});
