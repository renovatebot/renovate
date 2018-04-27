const { getPackageUpdates } = require('../../../lib/manager/buildkite/package');

const defaultConfig = require('../../../lib/config/defaults').getConfig();
const ghGot = require('../../../lib/platform/github/gh-got-wrapper');

jest.mock('../../../lib/platform/github/gh-got-wrapper');

describe('lib/manager/buildkite/package', () => {
  describe('getPackageUpdates()', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty if remote is https', async () => {
      config.depName = 'https://github.com/a/b';
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if remote is  git', async () => {
      config.depName = 'git@github.com/a/b.git';
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if current version is not semver', async () => {
      config.depName = 'some-plugin';
      config.currentVersion = 'abcdefg';
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if depName has more than one slash', async () => {
      config.depName = 'some/weird/plugin';
      config.currentVersion = 'v1.0.0';
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if no newer versions', async () => {
      config.depName = 'some-plugin';
      config.currentVersion = 'v1.0.0';
      ghGot.mockReturnValueOnce({
        body: [
          {
            ref: 'refs/tags/v0.9.0',
          },
          {
            ref: 'refs/tags/v1.0.0',
          },
        ],
      });
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns one upgrade', async () => {
      config.depName = 'some/plugin';
      config.currentVersion = 'v1.0.0';
      ghGot.mockReturnValueOnce({
        body: [
          {
            ref: 'refs/tags/v1.0.0',
          },
          {
            ref: 'refs/tags/v1.1.0',
          },
          {
            ref: 'refs/tags/v1.2.0',
          },
        ],
      });
      expect(await getPackageUpdates(config)).toMatchSnapshot();
    });
  });
});
