const {
  fetchUpdates,
} = require('../../../../lib/workers/repository/process/fetch');

const npm = require('../../../../lib/manager/npm');

describe('workers/repository/process/fetch', () => {
  describe('fetchUpdates()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = require('../../../_fixtures/config');
    });
    it('handles empty deps', async () => {
      const packageFiles = {
        npm: [{ packageFile: 'package.json', deps: [] }],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
    });
    it('handles ignores and disabled', async () => {
      config.ignoreDeps = ['abcd'];
      config.packageRules = [
        {
          packageNames: ['foo'],
          enabled: false,
        },
      ];
      const packageFiles = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              { depName: 'abcd' },
              { depName: 'zzzz' },
              { depName: 'foo' },
            ],
            internalPackages: ['zzzz'],
          },
        ],
      };
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles.npm[0].deps[0].skipReason).toEqual('ignored');
      expect(packageFiles.npm[0].deps[0].updates).toHaveLength(0);
      expect(packageFiles.npm[0].deps[1].skipReason).toEqual('monorepo');
      expect(packageFiles.npm[0].deps[1].updates).toHaveLength(0);
      expect(packageFiles.npm[0].deps[2].skipReason).toEqual('disabled');
      expect(packageFiles.npm[0].deps[2].updates).toHaveLength(0);
    });
    it('fetches updates', async () => {
      config.pinVersions = null;
      const packageFiles = {
        npm: [
          {
            packageFile: 'package.json',
            packageJsonType: 'app',
            deps: [
              { depName: 'aaa', depType: 'devDependencies' },
              { depName: 'bbb', depType: 'dependencies' },
            ],
          },
        ],
      };
      npm.getPackageUpdates = jest.fn(() => ['a', 'b']);
      await fetchUpdates(config, packageFiles);
      expect(packageFiles).toMatchSnapshot();
      expect(packageFiles.npm[0].deps[0].skipReason).toBeUndefined();
      expect(packageFiles.npm[0].deps[0].updates).toHaveLength(2);
    });
  });
});
