const { getPackageUpdates } = require('../../../lib/manager/nuget/package');
const nugetApi = require('../../../lib/datasource/nuget');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

nugetApi.getNuspec = jest.fn();
nugetApi.getVersions = jest.fn();

describe('lib/manager/nuget/package', () => {
  describe('getPackageUpdates()', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
        depName: 'some-dep',
        currentVersion: '2.3.0',
        lineNumber: 1337,
        ignoreUnstable: true,
      };
    });
    it('returns empty if no versions are found', async () => {
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if current version is not semver', async () => {
      config.currentVersion = undefined;
      nugetApi.getVersions.mockReturnValueOnce(['1.0.0']);
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if latest version is not semver', async () => {
      nugetApi.getVersions.mockReturnValueOnce(['5.0.0.0']);
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if highest version is current version', async () => {
      nugetApi.getVersions.mockReturnValueOnce([
        '1.0.0',
        config.currentVersion,
      ]);
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns higher version if available', async () => {
      nugetApi.getVersions.mockReturnValueOnce(['1.0.0', '2.3.1', '2.4.0']);
      expect(await getPackageUpdates(config)).toMatchSnapshot();
    });
    it('ignores unstable version if specified', async () => {
      nugetApi.getVersions.mockReturnValueOnce(['3.0.0-alpha1']);
      expect(await getPackageUpdates(config)).toEqual([]);
    });
  });
});
