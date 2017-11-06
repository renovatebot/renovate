jest.mock('../../../../lib/workers/package-file');

const packageFileWorker = require('../../../../lib/workers/package-file');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = require('../../../_fixtures/config');
});

const {
  determineRepoUpgrades,
} = require('../../../../lib/workers/repository/updates/determine');

describe('workers/repository/updates/determine', () => {
  describe('determineRepoUpgrades(config)', () => {
    it('returns empty array if none found', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
        },
        {
          packageFile: 'backend/package.json',
        },
      ];
      packageFileWorker.renovatePackageFile.mockReturnValue([]);
      const res = await determineRepoUpgrades(config);
      expect(res.upgrades).toHaveLength(0);
    });
    it('returns array if upgrades found', async () => {
      config.packageFiles = [
        {
          packageFile: 'Dockerfile',
        },
        {
          packageFile: 'backend/package.json',
        },
        {
          packageFile: 'frontend/package.js',
        },
      ];
      packageFileWorker.renovateDockerfile.mockReturnValueOnce([
        { depName: 'a' },
      ]);
      packageFileWorker.renovatePackageFile.mockReturnValueOnce([
        { depName: 'b' },
        { depName: 'c' },
      ]);
      packageFileWorker.renovateMeteorPackageFile.mockReturnValueOnce([
        { foo: 'd' },
      ]);
      const res = await determineRepoUpgrades(config);
      expect(res.upgrades).toHaveLength(4);
    });
  });
});
