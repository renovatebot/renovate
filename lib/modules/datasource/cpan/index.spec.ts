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
      expect(res).toMatchSnapshot();
    });
  });
});
