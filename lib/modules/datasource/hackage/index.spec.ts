import { getPkgReleases } from '..';
import { HackageDatasource, versionToRelease } from './index';
import * as httpMock from '~test/http-mock';

const baseUrl = 'https://hackage.haskell.org/';

describe('modules/datasource/hackage/index', () => {
  describe('versionToRelease', () => {
    it('should make release with given version', () => {
      expect(
        versionToRelease('3.1.0', 'base', 'http://localhost', false).version,
      ).toBe('3.1.0');
    });
  });

  describe('getReleases', () => {
    it('return null with empty registryUrl', async () => {
      expect(
        await new HackageDatasource().getReleases({
          packageName: 'base',
          registryUrl: undefined,
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/package/base.json').reply(404);
      expect(
        await getPkgReleases({
          datasource: HackageDatasource.id,
          packageName: 'base',
        }),
      ).toBeNull();
    });

    it('returns releases for 200', async () => {
      httpMock
        .scope(baseUrl)
        .get('/package/base.json')
        .reply(200, { '4.19.0.1': 'deprecated', '4.20.0.1': 'normal' });
      expect(
        await getPkgReleases({
          datasource: HackageDatasource.id,
          packageName: 'base',
        }),
      ).toEqual({
        registryUrl: baseUrl,
        releases: [
          {
            changelogUrl: baseUrl + 'package/base-4.19.0.1/changelog',
            version: '4.19.0.1',
            isDeprecated: true,
          },
          {
            changelogUrl: baseUrl + 'package/base-4.20.0.1/changelog',
            version: '4.20.0.1',
            isDeprecated: false,
          },
        ],
      });
    });
  });
});
