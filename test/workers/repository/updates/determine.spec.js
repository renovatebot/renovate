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
      packageFileWorker.renovatePackageJson.mockReturnValue([]);
      const res = await determineRepoUpgrades(config);
      expect(res.upgrades).toHaveLength(0);
    });
    it('returns array if upgrades found', async () => {
      config.packageFiles = [
        {
          packageFile: 'Dockerfile',
          manager: 'docker',
        },
        {
          packageFile: 'backend/package.json',
          manager: 'npm',
        },
        {
          packageFile: 'frontend/package.js',
          manager: 'meteor',
        },
        {
          packageFile: '.travis.yml',
          manager: 'node',
        },
        {
          packageFile: 'WORKSPACE',
          manager: 'bazel',
        },
      ];
      packageFileWorker.renovateDockerfile.mockReturnValueOnce([
        { depName: 'a' },
      ]);
      packageFileWorker.renovatePackageJson.mockReturnValueOnce([
        { depName: 'b' },
        { depName: 'c' },
      ]);
      packageFileWorker.renovateMeteorPackageFile.mockReturnValueOnce([
        { foo: 'd' },
      ]);
      packageFileWorker.renovateNodeFile.mockReturnValueOnce([{ foo: 'e' }]);
      packageFileWorker.renovateBazelFile.mockReturnValueOnce([{ bar: 'f' }]);
      const res = await determineRepoUpgrades(config);
      expect(res.upgrades).toHaveLength(6);
    });
  });
});
