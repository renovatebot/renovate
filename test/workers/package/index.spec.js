const pkgWorker = require('../../../lib/workers/package/index');
const defaultConfig = require('../../../lib/config/defaults').getConfig();
const configParser = require('../../../lib/config');
const logger = require('../../_fixtures/logger');
const docker = require('../../../lib/workers/package/docker');
const npm = require('../../../lib/workers/package/npm');

jest.mock('../../../lib/workers/package/docker');
jest.mock('../../../lib/workers/package/npm');

describe('lib/workers/package/index', () => {
  describe('renovatePackage(config)', () => {
    let config;
    beforeEach(() => {
      config = configParser.filterConfig(defaultConfig, 'package');
      config.logger = logger;
      config.depName = 'foo';
      config.currentVersion = '1.0.0';
    });
    it('returns empty if package is disabled', async () => {
      config.enabled = false;
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toMatchObject([]);
    });
    it('calls docker', async () => {
      docker.renovateDockerImage.mockReturnValueOnce([]);
      config.depType = 'Dockerfile';
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toMatchObject([]);
    });
    it('calls npm', async () => {
      npm.renovateNpmPackage.mockReturnValueOnce([]);
      config.depType = 'npm';
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toMatchObject([]);
    });
    it('maps and filters type', async () => {
      config.depType = 'npm';
      config.major.enabled = false;
      npm.renovateNpmPackage.mockReturnValueOnce([
        { type: 'pin' },
        { type: 'major' },
      ]);
      const res = await pkgWorker.renovatePackage(config);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchSnapshot();
      expect(res[0].groupName).toEqual('Pin Dependencies');
    });
  });
});
