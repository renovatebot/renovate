import { getPackageUpdates } from '../../../lib/manager/travis/package';
import { getPkgReleases as _getPkgReleases } from '../../../lib/datasource/github';
import { getConfig } from '../../../lib/config/defaults';

const defaultConfig = getConfig();
const getPkgReleases: any = _getPkgReleases;

jest.mock('../../../lib/datasource/github');

describe('lib/manager/travis/package', () => {
  describe('getPackageUpdates', () => {
    // TODO: should be `PackageUpdateConfig`
    let config: any;
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty if missing supportPolicy', async () => {
      config.currentValue = ['6', '8'];
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if invalid supportPolicy', async () => {
      config.currentValue = ['6', '8'];
      config.supportPolicy = ['foo'];
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns empty if matching', async () => {
      config.currentValue = ['10'];
      config.supportPolicy = ['lts_active'];
      expect(await getPackageUpdates(config)).toEqual([]);
    });
    it('returns result if needing updates', async () => {
      config.currentValue = ['6', '8', '10'];
      config.supportPolicy = ['lts'];
      expect(await getPackageUpdates(config)).toMatchSnapshot();
    });
    it('detects pinning', async () => {
      config.currentValue = ['6.1.0', '8.4.0', '10.0.0'];
      config.supportPolicy = ['lts'];
      getPkgReleases.mockReturnValueOnce({
        releases: [
          {
            version: '4.4.4',
          },
          {
            version: '5.5.5',
          },
          {
            version: '6.11.0',
          },
          {
            version: '7.0.0',
          },
          {
            version: '8.9.4',
          },
          {
            version: '9.5.0',
          },
          {
            version: '10.0.1',
          },
        ],
      });
      expect(await getPackageUpdates(config)).toMatchSnapshot();
    });
  });
});
