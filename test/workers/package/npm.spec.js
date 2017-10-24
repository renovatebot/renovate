const npmApi = require('../../../lib/registry/npm');
const versions = require('../../../lib/workers/package/versions');
const npm = require('../../../lib/workers/package/npm');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/registry/npm');
npmApi.getDependency = jest.fn();

describe('lib/workers/package/npm', () => {
  describe('renovateNpmPackage', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        logger,
        depName: 'some-dep',
        currentVersion: '1.0.0',
      };
    });
    it('returns warning if using invalid version', async () => {
      config.currentVersion =
        'git+ssh://git@github.com/joefraley/eslint-config-meridian.git';
      const res = await npm.renovateNpmPackage(config);
      expect(res).toMatchSnapshot();
    });
    it('returns warning if no npm dep found', async () => {
      const res = await npm.renovateNpmPackage(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('warning');
      expect(npmApi.getDependency.mock.calls.length).toBe(1);
    });
    it('returns warning if no npm dep found and lock file', async () => {
      config.packageLock = 'some package lock';
      const res = await npm.renovateNpmPackage(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('warning');
      expect(npmApi.getDependency.mock.calls.length).toBe(1);
    });
    it('returns error if no npm scoped dep found', async () => {
      config.depName = '@foo/something';
      config.yarnLock = '# some yarn lock';
      const res = await npm.renovateNpmPackage(config);
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('warning');
    });
    it('returns warning if warning found', async () => {
      npmApi.getDependency.mockReturnValueOnce({});
      versions.determineUpgrades = jest.fn(() => [
        {
          type: 'warning',
          message: 'bad version',
        },
      ]);
      const res = await npm.renovateNpmPackage(config);
      expect(res[0].type).toEqual('warning');
    });
    it('returns array if upgrades found', async () => {
      npmApi.getDependency.mockReturnValueOnce({ repositoryUrl: 'some-url' });
      versions.determineUpgrades = jest.fn(() => [{}]);
      const res = await npm.renovateNpmPackage(config);
      expect(res).toHaveLength(1);
      expect(Object.keys(res[0])).toMatchSnapshot();
      expect(res[0].repositoryUrl).toBeDefined();
    });
  });
});
