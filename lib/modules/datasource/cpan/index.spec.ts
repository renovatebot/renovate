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
            body.query.filtered.filter.and[0].term['module.name'] === 'FooBar'
        )
        .reply(200, Fixtures.get('empty.json'));
      expect(
        await getPkgReleases({
          datasource: CpanDatasource.id,
          depName: 'FooBar',
        })
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).post('/v1/file/_search').reply(404);
      expect(
        await getPkgReleases({
          datasource: CpanDatasource.id,
          depName: 'Plack',
        })
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).post('/v1/file/_search').reply(502);
      await expect(
        getPkgReleases({
          datasource: CpanDatasource.id,
          depName: 'Plack',
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).post('/v1/file/_search').replyWithError('');
      expect(
        await getPkgReleases({
          datasource: CpanDatasource.id,
          depName: 'Plack',
        })
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .post(
          '/v1/file/_search',
          (body) =>
            body.query.filtered.filter.and[0].term['module.name'] === 'Plack'
        )
        .reply(200, Fixtures.get('Plack.json'));
      const res = await getPkgReleases({
        datasource: CpanDatasource.id,
        depName: 'Plack',
      });
      expect(res).toMatchObject({
        changelogUrl: 'https://metacpan.org/dist/Plack/changes',
        homepage: 'https://metacpan.org/pod/Plack',
        registryUrl: 'https://fastapi.metacpan.org/',
        releases: [
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2015-12-06T11:29:40.000Z',
            version: '1.0039',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: false,
            releaseTimestamp: '2016-04-01T16:58:21.000Z',
            version: '1.0040',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2016-09-25T21:25:47.000Z',
            version: '1.0041',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2016-09-29T05:38:42.000Z',
            version: '1.0042',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2017-02-22T03:02:05.000Z',
            version: '1.0043',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2017-04-27T17:48:20.000Z',
            version: '1.0044',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2017-12-31T20:42:50.000Z',
            version: '1.0045',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2018-02-10T07:52:31.000Z',
            version: '1.0046',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2018-02-10T09:25:30.000Z',
            version: '1.0047',
          },
          {
            distribution: 'Plack',
            isDeprecated: false,
            isStable: true,
            releaseTimestamp: '2020-11-30T00:21:36.000Z',
            version: '1.0048',
          },
        ],
      });
    });
  });
});
