const packageFileWorker = require('../../../lib/workers/package-file');
const depTypeWorker = require('../../../lib/workers/dep-type');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/dep-type');
jest.mock('../../../lib/workers/branch/schedule');

describe('packageFileWorker', () => {
  describe('findUpgrades(config)', () => {
    let config;
    beforeEach(() => {
      config = Object.assign({}, defaultConfig, {
        packageFile: 'package.json',
        repoIsOnboarded: true,
        api: {
          getFileContent: jest.fn(),
          getFileJson: jest.fn(),
        },
        depTypes: ['dependencies', 'devDependencies'],
        logger,
      });
    });
    it('handles null', async () => {
      const allUpgrades = await packageFileWorker.findUpgrades(config);
      expect(allUpgrades).toHaveLength(1);
      expect(allUpgrades[0].type).toEqual('error');
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
      config.contentBaseBranch = 'renovate/configure';
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
    it('maintains lock files', async () => {
      config.api.getFileJson.mockReturnValueOnce({});
      config.api.getFileContent.mockReturnValueOnce('some-content-1');
      config.api.getFileContent.mockReturnValueOnce('some-content-2');
      depTypeWorker.findUpgrades.mockReturnValueOnce([]);
      depTypeWorker.findUpgrades.mockReturnValueOnce([]);
      const res = await packageFileWorker.findUpgrades(config);
      expect(res).toHaveLength(1);
    });
  });
});
