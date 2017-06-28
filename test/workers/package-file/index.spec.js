const packageFileWorker = require('../../../lib/workers/package-file');
const depTypeWorker = require('../../../lib/workers/dep-type');

jest.mock('../../../lib/workers/dep-type');

describe('packageFileWorker', () => {
  describe('findUpgrades(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        repoIsOnboarded: true,
        api: {
          getFileJson: jest.fn(),
        },
        depTypes: ['dependencies', 'devDependencies'],
      };
      packageFileWorker.updateBranch = jest.fn();
    });
    it('handles null', async () => {
      const allUpgrades = await packageFileWorker.findUpgrades(config);
      expect(allUpgrades).toHaveLength(0);
    });
    it('handles no renovate config', async () => {
      config.enabled = false;
      config.api.getFileJson.mockReturnValueOnce({});
      const res = await packageFileWorker.findUpgrades(config);
      expect(config.api.getFileJson.mock.calls[0][1]).toBeUndefined();
      expect(res).toEqual([]);
    });
    it('uses onboarding branch', async () => {
      config.enabled = false;
      config.repoIsOnboarded = false;
      config.api.getFileJson.mockReturnValueOnce({});
      const res = await packageFileWorker.findUpgrades(config);
      expect(config.api.getFileJson.mock.calls[0][1]).toEqual(
        'renovate/configure'
      );
      expect(res).toEqual([]);
    });
    it('returns empty array if config disabled', async () => {
      config.api.getFileJson.mockReturnValueOnce({
        renovate: {
          enabled: false,
        },
      });
      const res = await packageFileWorker.findUpgrades(config);
      expect(res).toEqual([]);
    });
    it('calls depTypeWorker', async () => {
      config.api.getFileJson.mockReturnValueOnce({});
      depTypeWorker.findUpgrades.mockReturnValueOnce([{}]);
      depTypeWorker.findUpgrades.mockReturnValueOnce([{}, {}]);
      const res = await packageFileWorker.findUpgrades(config);
      expect(res).toHaveLength(3);
    });
    it('maintains yarn.lock', async () => {
      config.api.getFileJson.mockReturnValueOnce({});
      config.maintainYarnLock = true;
      depTypeWorker.findUpgrades.mockReturnValue([]);
      const res = await packageFileWorker.findUpgrades(config);
      expect(res).toHaveLength(1);
    });
  });
});
