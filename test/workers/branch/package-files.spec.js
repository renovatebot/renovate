const packageJsonHelper = require('../../../lib/workers/branch/package-json');
const packageJsHelper = require('../../../lib/workers/branch/package-js');
const dockerHelper = require('../../../lib/workers/branch/dockerfile');
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
        parentBranch: 'some-branch',
      };
      packageJsonHelper.setNewValue = jest.fn();
      dockerHelper.setNewValue = jest.fn();
      packageJsHelper.setNewValue = jest.fn();
    });
    it('returns empty if lock file maintenance', async () => {
      config.upgrades = [{ type: 'lockFileMaintenance' }];
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(0);
    });
    it('recurses if setNewValue error', async () => {
      config.parentBranch = 'some-branch';
      config.canRebase = true;
      config.upgrades = [{ packageFile: 'package.json' }];
      packageJsonHelper.setNewValue.mockReturnValueOnce(null);
      packageJsonHelper.setNewValue.mockReturnValueOnce('some content');
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(1);
    });
    it('errors if cannot rebase', async () => {
      config.upgrades = [{ packageFile: 'package.json' }];
      let e;
      try {
        await getUpdatedPackageFiles(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
    it('returns updated files', async () => {
      config.parentBranch = 'some-branch';
      config.canRebase = true;
      config.upgrades = [
        { packageFile: 'package.json' },
        { packageFile: 'Dockerfile' },
        { packageFile: 'packages/foo/package.js' },
      ];
      config.api.getFileContent.mockReturnValueOnce('old content 1');
      config.api.getFileContent.mockReturnValueOnce('old content 1');
      config.api.getFileContent.mockReturnValueOnce('old content 2');
      config.api.getFileContent.mockReturnValueOnce('old content 3');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content 1');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content 1+');
      dockerHelper.setNewValue.mockReturnValueOnce('new content 2');
      packageJsHelper.setNewValue.mockReturnValueOnce('old content 3');
      const res = await getUpdatedPackageFiles(config);
      expect(res.updatedPackageFiles).toHaveLength(2);
    });
  });
});
