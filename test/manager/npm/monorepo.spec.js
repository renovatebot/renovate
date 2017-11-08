const { checkMonorepos } = require('../../../lib/manager/npm/monorepos');

let config;
beforeEach(() => {
  jest.resetAllMocks();
  config = { ...require('../../_fixtures/config') };
  config.errors = [];
  config.warnings = [];
});

describe('manager/npm/monorepo', () => {
  describe('checkMonorepos', () => {
    it('adds yarn workspaces', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          content: { workspaces: ['packages/*'] },
        },
        {
          packageFile: 'packages/something/package.json',
          content: { name: '@a/b' },
        },
        {
          packageFile: 'packages/something-else/package.json',
          content: { name: '@a/c' },
        },
      ];
      const res = await checkMonorepos(config);
      expect(res.monorepoPackages).toMatchSnapshot();
    });
    it('adds nested yarn workspaces', async () => {
      config.packageFiles = [
        {
          packageFile: 'frontend/package.json',
          content: { workspaces: ['packages/*'] },
        },
        {
          packageFile: 'frontend/packages/something/package.json',
          content: { name: '@a/b' },
        },
        {
          packageFile: 'frontend/packages/something-else/package.json',
          content: { name: '@a/c' },
        },
      ];
      const res = await checkMonorepos(config);
      expect(res.monorepoPackages).toMatchSnapshot();
    });
    it('adds lerna packages', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          content: {},
        },
        {
          packageFile: 'packages/something/package.json',
          content: { name: '@a/b' },
        },
        {
          packageFile: 'packages/something-else/package.json',
          content: { name: '@a/c' },
        },
      ];
      platform.getFile.mockReturnValue('{ "packages": ["packages/*"] }');
      const res = await checkMonorepos(config);
      expect(res.monorepoPackages).toMatchSnapshot();
    });
    it('skips if no lerna packages', async () => {
      config.packageFiles = [
        {
          packageFile: 'package.json',
          content: {},
        },
      ];
      platform.getFile.mockReturnValue(null);
      const res = await checkMonorepos(config);
      expect(res.monorepoPackages).toMatchSnapshot();
    });
  });
});
