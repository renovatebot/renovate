const pkgWorker = require('../../../lib/workers/package/index');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const configParser = require('../../../lib/config');

const docker = require('../../../lib/manager/docker/package');
const npm = require('../../../lib/manager/npm/package');
const node = require('../../../lib/manager/travis/package');
const bazel = require('../../../lib/manager/bazel/package');

jest.mock('../../../lib/manager/docker/package');
jest.mock('../../../lib/manager/npm/package');
jest.mock('../../../lib/manager/travis/package');
jest.mock('../../../lib/manager/bazel/package');

describe('lib/workers/package/index', () => {
  describe('renovatePackage(config)', () => {
    let config;
    beforeEach(() => {
      config = configParser.filterConfig(defaultConfig, 'package');
      config.depName = 'foo';
      config.currentVersion = '1.0.0';
    });
    it('returns empty if package is disabled', async () => {
      config.enabled = false;
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toMatchObject([]);
    });
    it('calls docker', async () => {
      docker.getPackageUpdates.mockReturnValueOnce([]);
      config.manager = 'docker';
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toMatchObject([]);
    });
    it('calls meteor', async () => {
      npm.getPackageUpdates.mockReturnValueOnce([]);
      config.manager = 'meteor';
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toMatchObject([]);
    });
    it('calls node', async () => {
      node.getPackageUpdates.mockReturnValueOnce([]);
      config.manager = 'travis';
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toMatchObject([]);
    });
    it('calls bazel', async () => {
      bazel.getPackageUpdates.mockReturnValueOnce([]);
      config.manager = 'bazel';
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toMatchObject([]);
    });
    it('maps and filters type', async () => {
      config.manager = 'npm';
      config.major.enabled = false;
      npm.getPackageUpdates.mockReturnValueOnce([
        { type: 'pin' },
        { type: 'major' },
        { type: 'minor', enabled: false },
      ]);
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toHaveLength(1);
      expect(res[0].groupName).toEqual('Pin Dependencies');
    });
    it('throws', async () => {
      npm.getPackageUpdates.mockReturnValueOnce([]);
      config.packageFile = 'something-else';
      let e;
      try {
        await pkgWorker.renovatePackage(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
  });
});
