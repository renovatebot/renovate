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
  });
});
