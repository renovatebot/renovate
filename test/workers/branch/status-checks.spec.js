const {
  setUnpublishable,
} = require('../../../lib/workers/branch/status-checks');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');

describe('workers/branch/status-checks', () => {
  describe('setUnpublishable', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: { getBranchStatusCheck: jest.fn(), setBranchStatus: jest.fn() },
        logger,
        upgrades: [],
      };
    });
    it('defaults to unpublishable', async () => {
      await setUnpublishable(config);
      expect(config.api.getBranchStatusCheck.mock.calls.length).toBe(1);
      expect(config.api.setBranchStatus.mock.calls.length).toBe(0);
    });
    it('finds unpublishable true', async () => {
      config.upgrades = [{ unpublishable: true }];
      await setUnpublishable(config);
      expect(config.api.getBranchStatusCheck.mock.calls.length).toBe(1);
      expect(config.api.setBranchStatus.mock.calls.length).toBe(0);
    });
    it('removes status check', async () => {
      config.upgrades = [{ unpublishable: true }];
      config.api.getBranchStatusCheck.mockReturnValueOnce('pending');
      await setUnpublishable(config);
      expect(config.api.getBranchStatusCheck.mock.calls.length).toBe(1);
      expect(config.api.setBranchStatus.mock.calls.length).toBe(1);
    });
    it('finds unpublishable false and sets status', async () => {
      config.unpublishSafe = true;
      config.upgrades = [{ unpublishable: true }, { unpublishable: false }];
      await setUnpublishable(config);
      expect(config.api.getBranchStatusCheck.mock.calls.length).toBe(1);
      expect(config.api.setBranchStatus.mock.calls.length).toBe(1);
    });
    it('finds unpublishable false and skips status', async () => {
      config.unpublishSafe = true;
      config.upgrades = [{ unpublishable: true }, { unpublishable: false }];
      config.api.getBranchStatusCheck.mockReturnValueOnce('pending');
      await setUnpublishable(config);
      expect(config.api.getBranchStatusCheck.mock.calls.length).toBe(1);
      expect(config.api.setBranchStatus.mock.calls.length).toBe(0);
    });
  });
});
