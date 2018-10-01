const composer = require('../../../lib/manager/composer');
const npm = require('../../../lib/manager/npm');
const {
  getUpdatedPackageFiles,
} = require('../../../lib/workers/branch/get-updated');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

describe('workers/branch/get-updated', () => {
  describe('getUpdatedPackageFiles()', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        upgrades: [],
      };
      composer.updateDependency = jest.fn();
      composer.getArtifacts = jest.fn();
      npm.updateDependency = jest.fn();
    });
    it('handles empty', async () => {
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles null content', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'npm',
      });
      let e;
      try {
        await getUpdatedPackageFiles(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
    it('handles content change', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'npm',
      });
      npm.updateDependency.mockReturnValue('some new content');
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles lock files', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'composer',
      });
      composer.updateDependency.mockReturnValue('some new content');
      composer.getArtifacts.mockReturnValue({
        file: {
          name: 'composer.json',
          contents: 'some contents',
        },
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
    it('handles lock file errors', async () => {
      config.parentBranch = 'some-branch';
      config.upgrades.push({
        manager: 'composer',
      });
      composer.updateDependency.mockReturnValue('some new content');
      composer.getArtifacts.mockReturnValue({
        lockFileError: {
          name: 'composer.lock',
          stderr: 'some error',
        },
      });
      const res = await getUpdatedPackageFiles(config);
      expect(res).toMatchSnapshot();
    });
  });
});
