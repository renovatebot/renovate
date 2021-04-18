import { getName } from '../../../test/util';
import { getConfig } from '../../config/defaults';
import { getPkgReleases as _getPkgReleases } from '../../datasource';
import { getPackageUpdates } from './package';

const defaultConfig = getConfig();
const getPkgReleases: any = _getPkgReleases;

jest.mock('../../datasource');

describe(getName(__filename), () => {
  describe('getPackageUpdates', () => {
    // TODO: should be `PackageUpdateConfig`
    let config: any;
    const RealDate = Date;

    beforeAll(() => {
      global.Date = class FakeDate extends RealDate {
        constructor(arg?: number | string | Date) {
          super(arg ?? '2020-10-28');
        }
      } as any;
    });
    afterAll(() => {
      global.Date = RealDate;
    });
    beforeEach(() => {
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty if missing supportPolicy', async () => {
      config.currentValue = ['6', '8'];
      expect(await getPackageUpdates(config)).toEqual({ updates: [] });
    });
    it('returns empty if invalid supportPolicy', async () => {
      config.currentValue = ['6', '8'];
      config.supportPolicy = ['foo'];
      expect(await getPackageUpdates(config)).toEqual({ updates: [] });
    });
    it('returns empty if matching', async () => {
      config.currentValue = ['12', '14'];
      config.supportPolicy = ['lts_active'];
      expect(await getPackageUpdates(config)).toEqual({ updates: [] });
    });
    it('returns result if needing updates', async () => {
      config.currentValue = ['6', '8', '10'];
      config.supportPolicy = ['lts'];
      expect(await getPackageUpdates(config)).toMatchSnapshot();
    });
    it('detects pinning', async () => {
      config.currentValue = ['8.4.0', '10.0.0', '12.0.0'];
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
          {
            version: '12.3.0',
          },
        ],
      });
      expect(await getPackageUpdates(config)).toMatchSnapshot();
    });
  });
});
