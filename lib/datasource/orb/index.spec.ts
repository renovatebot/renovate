import * as globalCache from '../../util/cache/global';
import * as runCache from '../../util/cache/run';
import _got from '../../util/got';
import * as datasource from '.';

jest.mock('../../util/got');

const got: any = _got;

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
        { version: '4.1.1', createdAt: '2018-12-11T18:24:13.119Z' },
        { version: '4.1.0', createdAt: '2018-12-11T18:14:41.116Z' },
        { version: '4.0.0', createdAt: '2018-12-11T17:41:26.595Z' },
        { version: '3.0.0', createdAt: '2018-12-11T05:28:14.080Z' },
      ],
    },
  },
};

describe('datasource/orb', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      runCache.clear();
      return globalCache.rmAll();
    });
    it('returns null for empty result', async () => {
      got.mockReturnValueOnce({ body: {} });
      expect(
        await datasource.getReleases({
          lookupName: 'hyper-expanse/library-release-workflows',
        })
      ).toBeNull();
    });
    it('returns null for missing orb', async () => {
      got.mockReturnValueOnce({ body: { data: {} } });
      expect(
        await datasource.getReleases({
          lookupName: 'hyper-expanse/library-release-wonkflows',
        })
      ).toBeNull();
    });
    it('returns null for 404', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
        })
      );
      expect(
        await datasource.getReleases({
          lookupName: 'hyper-expanse/library-release-workflows',
        })
      ).toBeNull();
    });
    it('returns null for unknown error', async () => {
      got.mockImplementationOnce(() => {
        throw new Error();
      });
      expect(
        await datasource.getReleases({
          lookupName: 'hyper-expanse/library-release-workflows',
        })
      ).toBeNull();
    });
    it('processes real data', async () => {
      got.mockReturnValueOnce({
        body: orbData,
      });
      const res = await datasource.getReleases({
        lookupName: 'hyper-expanse/library-release-workflows',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
    it('processes homeUrl', async () => {
      orbData.data.orb.homeUrl = 'https://google.com';
      got.mockReturnValueOnce({
        body: orbData,
      });
      const res = await datasource.getReleases({
        lookupName: 'hyper-expanse/library-release-workflows',
      });
      expect(res).toMatchSnapshot();
      expect(res.homepage).toEqual('https://google.com');
    });
  });
});
