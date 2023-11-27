import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { OrbDatasource } from '.';

const orbData = {
  data: {
    orb: {
      name: 'hutson/library-release-workflows',
      homeUrl: '',
      versions: [
        { version: '4.2.0', createdAt: '2018-12-13T23:19:09.356Z' },
        { version: '4.1.6', createdAt: '2018-12-12T18:56:42.563Z' },
        { version: '4.1.5', createdAt: '2018-12-12T17:13:31.542Z' },
        { version: '4.1.4', createdAt: '2018-12-11T22:13:29.297Z' },
        { version: '4.1.3', createdAt: '2018-12-11T21:40:44.870Z' },
        { version: '4.1.2', createdAt: '2018-12-11T21:28:37.846Z' },
        { version: '4.1.1' },
        { version: '4.1.0', createdAt: '2018-12-11T18:14:41.116Z' },
        { version: '4.0.0', createdAt: '2018-12-11T17:41:26.595Z' },
        { version: '3.0.0', createdAt: '2018-12-11T05:28:14.080Z' },
      ],
    },
  },
};

const baseUrl = 'https://circleci.com';

const datasource = OrbDatasource.id;

describe('modules/datasource/orb/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock.scope(baseUrl).post('/graphql-unstable').reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hyper-expanse/library-release-workflows',
        }),
      ).toBeNull();
    });

    it('returns null for missing orb', async () => {
      httpMock
        .scope(baseUrl)
        .post('/graphql-unstable')
        .reply(200, { data: {} });
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hyper-expanse/library-release-wonkflows',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).post('/graphql-unstable').reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hyper-expanse/library-release-workflows',
        }),
      ).toBeNull();
    });

    it('returns null for unknown error', async () => {
      httpMock.scope(baseUrl).post('/graphql-unstable').replyWithError('');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hyper-expanse/library-release-workflows',
        }),
      ).toBeNull();
    });

    it('processes real data', async () => {
      httpMock.scope(baseUrl).post('/graphql-unstable').reply(200, orbData);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hyper-expanse/library-release-workflows',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('processes homeUrl', async () => {
      orbData.data.orb.homeUrl = 'https://google.com';
      httpMock.scope(baseUrl).post('/graphql-unstable').reply(200, orbData);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hyper-expanse/library-release-workflows',
      });
      expect(res).toMatchSnapshot();
      expect(res?.homepage).toBe('https://google.com');
    });
  });
});
