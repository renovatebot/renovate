const {
  getPackageUpdates,
} = require('../../../lib/manager/pip_requirements/package');

const defaultConfig = require('../../../lib/config/defaults').getConfig();
const got = require('got');

jest.mock('got');

describe('lib/manager/pip_requirements/package', () => {
  describe('getPackageUpdates()', () => {
    let config;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty on error', async () => {
      config.depName = 'some-package';
      config.currentValue = '1.0.0';
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if current version is not semver', async () => {
      config.depName = 'some-package';
      config.currentValue = 'abcdefg';
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if no newer versions', async () => {
      config.depName = 'some-package';
      config.currentValue = '0.3.2';
      got.mockReturnValueOnce({
        body: {
          releases: {
            '0.2.0': [],
            '0.3.2': [],
          },
        },
      });
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns one upgrade', async () => {
      config.depName = 'some-package';
      config.currentValue = '0.3.2';
      got.mockReturnValueOnce({
        body: {
          releases: {
            '0.2': [],
            '0.2.0': [],
            '0.3.2': [],
            '0.3.4': [],
            '1.0.0': [],
            '1.0.2': [],
          },
        },
      });
      expect(await getPackageUpdates(config)).toMatchSnapshot();
    });
  });
});
