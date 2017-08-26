const packageFileWorker = require('../../../lib/workers/package-file');
const depTypeWorker = require('../../../lib/workers/dep-type');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

const logger = require('../../_fixtures/logger');

jest.mock('../../../lib/workers/dep-type');
jest.mock('../../../lib/workers/branch/schedule');

describe('packageFileWorker', () => {
  describe('renovatePackageFile(config)', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        packageFile: 'package.json',
        content: {},
        repoIsOnboarded: true,
        npmrc: '# nothing',
        logger,
      };
      depTypeWorker.renovateDepType.mockReturnValue([]);
    });
    it('returns empty if disabled', async () => {
      config.enabled = false;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toEqual([]);
    });
    it('warns if using workspaces', async () => {
      config.content.workspaces = {};
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(1);
      expect(res[0].type).toEqual('warning');
    });
    it('returns upgrades', async () => {
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([{}, {}]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([]);
      depTypeWorker.renovateDepType.mockReturnValueOnce([]);
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(3);
    });
    it('maintains lock files', async () => {
      config.hasYarnLock = true;
      const res = await packageFileWorker.renovatePackageFile(config);
      expect(res).toHaveLength(1);
    });
  });
});
