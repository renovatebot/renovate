import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { datasource, defaultRegistryUrl } from './common.ts';

describe('modules/datasource/node-version/index', () => {
  describe('getReleases', () => {
    it('throws for 500', async () => {
      httpMock.scope(defaultRegistryUrl).get('/index.json').reply(500);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'node',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for error', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/index.json')
        .replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'node',
        }),
      ).resolves.toBeNull();
    });

    it('returns null for empty 200 OK', async () => {
      httpMock.scope(defaultRegistryUrl).get('/index.json').reply(200, []);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'node',
        }),
      ).resolves.toBeNull();
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/index.json')
        .reply(200, Fixtures.get('index.json'));
      const res = await getPkgReleases({
        datasource,
        packageName: 'node',
      });
      expect(res).toEqual({
        homepage: 'https://nodejs.org',
        sourceUrl: 'https://github.com/nodejs/node',
        registryUrl: 'https://nodejs.org/dist',
        releases: expect.any(Array),
      });
      expect(res?.releases).toHaveLength(64);
      expect(res?.releases[0]).toEqual({
        isStable: false,
        releaseTimestamp: '2020-04-21T00:00:00.000Z',
        version: 'v14.0.0',
      });
      // last non-LTS 14.x, then the first LTS one
      expect(res?.releases.slice(16, 18)).toEqual([
        {
          isStable: false,
          releaseTimestamp: '2020-10-15T00:00:00.000Z',
          version: 'v14.14.0',
        },
        {
          isStable: true,
          releaseTimestamp: '2020-10-27T00:00:00.000Z',
          version: 'v14.15.0',
        },
      ]);
      // last LTS 14.x, then back to non-LTS for 15.x
      expect(res?.releases.slice(31, 33)).toEqual([
        {
          isStable: true,
          releaseTimestamp: '2021-08-30T00:00:00.000Z',
          version: 'v14.17.6',
        },
        {
          isStable: false,
          releaseTimestamp: '2020-10-20T00:00:00.000Z',
          version: 'v15.0.0',
        },
      ]);
      expect(res?.releases[50]).toEqual({
        isStable: false,
        releaseTimestamp: '2021-04-20T00:00:00.000Z',
        version: 'v16.0.0',
      });
      expect(res?.releases[63]).toEqual({
        isStable: false,
        releaseTimestamp: '2021-09-07T00:00:00.000Z',
        version: 'v16.9.0',
      });
    });
  });
});
