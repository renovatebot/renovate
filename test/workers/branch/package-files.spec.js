const packageJsonHelper = require('../../../lib/workers/branch/package-json');
const packageJsHelper = require('../../../lib/workers/branch/package-js');
const {
  getUpdatedPackageFiles,
} = require('../../../lib/workers/branch/package-files');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');

describe('workers/branch/package-files', () => {
  describe('getUpdatedPackageFiles', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        api: { getFileContent: jest.fn() },
        logger,
      };
      packageJsonHelper.setNewValue = jest.fn();
      packageJsHelper.setNewValue = jest.fn();
    });
    it('returns empty if lock file maintenance', async () => {
      config.upgrades = [{ type: 'lockFileMaintenance' }];
      const res = await getUpdatedPackageFiles(config);
      expect(res).toHaveLength(0);
    });
    it('returns updated files', async () => {
      config.upgrades = [
        { packageFile: 'package.json' },
        { packageFile: 'backend/package.json' },
        { packageFile: 'packages/foo/package.js' },
      ];
      config.api.getFileContent.mockReturnValueOnce('old content 1');
      config.api.getFileContent.mockReturnValueOnce('old content 2');
      config.api.getFileContent.mockReturnValueOnce('old content 3');
      packageJsonHelper.setNewValue.mockReturnValueOnce('old content 1');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content 2');
      packageJsHelper.setNewValue.mockReturnValueOnce('old content 3');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toHaveLength(1);
    });
  });
});
