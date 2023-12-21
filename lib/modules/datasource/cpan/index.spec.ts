import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { CpanDatasource } from '.';

const baseUrl = 'https://fastapi.metacpan.org/';

describe('modules/datasource/cpan/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          '/v1/file/_search',
          (body) =>
            body.query.filtered.filter.and[0].term['module.name'] === 'FooBar',
        )
        .reply(200, Fixtures.get('empty.json'));
      expect(
        await getPkgReleases({
          datasource: CpanDatasource.id,
          packageName: 'FooBar',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).post('/v1/file/_search').reply(404);
      expect(
        await getPkgReleases({
          datasource: CpanDatasource.id,
          packageName: 'Plack',
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).post('/v1/file/_search').reply(502);
      await expect(
        getPkgReleases({
          datasource: CpanDatasource.id,
          packageName: 'Plack',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).post('/v1/file/_search').replyWithError('');
      expect(
        await getPkgReleases({
          datasource: CpanDatasource.id,
          packageName: 'Plack',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          '/v1/file/_search',
          (body) =>
            body.query.filtered.filter.and[0].term['module.name'] === 'Plack',
        )
        .reply(200, Fixtures.get('Plack.json'));
      const res = await getPkgReleases({
        datasource: CpanDatasource.id,
        packageName: 'Plack',
      });
      expect(res).toMatchObject({
        changelogUrl: 'https://metacpan.org/dist/Plack/changes',
        homepage: 'https://metacpan.org/pod/Plack',
        registryUrl: 'https://fastapi.metacpan.org/',
        releases: expect.toBeArrayOfSize(10),
      });
      expect(res?.releases[1]).toMatchObject({
        isDeprecated: false,
        isStable: false,
        releaseTimestamp: '2016-04-01T16:58:21.000Z',
        version: '1.0040',
      });
      expect(res?.releases[9]).toMatchObject({
        isDeprecated: false,
        isStable: true,
        releaseTimestamp: '2020-11-30T00:21:36.000Z',
        version: '1.0048',
      });
    });
  });
});
