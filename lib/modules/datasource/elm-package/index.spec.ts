import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { ElmPackageDatasource } from './index.ts';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';

const body = Fixtures.getJson('elm-core.json');

const baseUrl = 'https://package.elm-lang.org';

describe('modules/datasource/elm-package/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/elm/nonexistent/releases.json')
        .reply(200, {});
      expect(
        await getPkgReleases({
          datasource: ElmPackageDatasource.id,
          packageName: 'elm/nonexistent',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/elm/nonexistent/releases.json')
        .reply(404);
      expect(
        await getPkgReleases({
          datasource: ElmPackageDatasource.id,
          packageName: 'elm/nonexistent',
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/elm/core/releases.json')
        .reply(502);
      await expect(
        getPkgReleases({
          datasource: ElmPackageDatasource.id,
          packageName: 'elm/core',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('throws for 429', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/elm/core/releases.json')
        .reply(429);
      await expect(
        getPkgReleases({
          datasource: ElmPackageDatasource.id,
          packageName: 'elm/core',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/elm/core/releases.json')
        .replyWithError('');
      expect(
        await getPkgReleases({
          datasource: ElmPackageDatasource.id,
          packageName: 'elm/core',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/elm/core/releases.json')
        .reply(200, body);
      const res = await getPkgReleases({
        datasource: ElmPackageDatasource.id,
        packageName: 'elm/core',
      });
      expect(res).toEqual({
        registryUrl: 'https://package.elm-lang.org',
        releases: [
          { version: '1.0.0', releaseTimestamp: '2018-08-20T13:27:02.000Z' },
          { version: '1.0.1', releaseTimestamp: '2018-11-14T12:45:11.000Z' },
          { version: '1.0.2', releaseTimestamp: '2018-11-15T21:38:13.000Z' },
          { version: '1.0.3', releaseTimestamp: '2019-12-05T17:16:56.000Z' },
          { version: '1.0.4', releaseTimestamp: '2019-12-10T17:19:57.000Z' },
          { version: '1.0.5', releaseTimestamp: '2020-02-15T19:16:35.000Z' },
        ],
        sourceUrl: 'https://github.com/elm/core',
      });
    });

    it('handles package without slash in name', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages/somepackage/releases.json')
        .reply(200, { '1.0.0': 1534771622 });
      const res = await getPkgReleases({
        datasource: ElmPackageDatasource.id,
        packageName: 'somepackage',
      });
      expect(res).toEqual({
        registryUrl: 'https://package.elm-lang.org',
        releases: [
          { version: '1.0.0', releaseTimestamp: '2018-08-20T13:27:02.000Z' },
        ],
      });
    });
  });
});
