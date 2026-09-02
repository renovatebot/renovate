import type { z } from 'zod/v4';
import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { OrbDatasource } from './index.ts';
import type { OrbPackagesResponse } from './schema.ts';

const orbData: z.input<typeof OrbPackagesResponse> = {
  data: [
    {
      attributes: {
        is_private: false,
      },
      references: {
        orb_versions: [
          {
            attributes: {
              version: '4.2.0',
              created_at: '2018-12-13T23:19:09.356Z',
            },
          },
          {
            attributes: {
              version: '4.1.6',
              created_at: '2018-12-12T18:56:42.563Z',
            },
          },
          {
            attributes: {
              version: '4.1.5',
              created_at: '2018-12-12T17:13:31.542Z',
            },
          },
          {
            attributes: {
              version: '4.1.4',
              created_at: '2018-12-11T22:13:29.297Z',
            },
          },
          {
            attributes: {
              version: '4.1.3',
              created_at: '2018-12-11T21:40:44.870Z',
            },
          },
          {
            attributes: {
              version: '4.1.2',
              created_at: '2018-12-11T21:28:37.846Z',
            },
          },
          { attributes: { version: '4.1.1' } },
          {
            attributes: {
              version: '4.1.0',
              created_at: '2018-12-11T18:14:41.116Z',
            },
          },
          {
            attributes: {
              version: '4.0.0',
              created_at: '2018-12-11T17:41:26.595Z',
            },
          },
          {
            attributes: {
              version: '3.0.0',
              created_at: '2018-12-11T05:28:14.080Z',
            },
          },
        ],
      },
    },
  ],
};

const packagesPath = '/api/v3/orb/packages';
const packagesQuery = {
  'filter[name]': 'hyper-expanse/library-release-workflows',
};

const baseUrl = 'https://circleci.com';

const datasource = OrbDatasource.id;

describe('modules/datasource/orb/index', () => {
  describe('getReleases', () => {
    it('returns null for empty result', async () => {
      httpMock
        .scope(baseUrl)
        .get(packagesPath)
        .query(packagesQuery)
        .reply(200, {});
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
        .get(packagesPath)
        .query(packagesQuery)
        .reply(200, { data: [] });
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hyper-expanse/library-release-workflows',
        }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get(packagesPath).query(packagesQuery).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hyper-expanse/library-release-workflows',
        }),
      ).toBeNull();
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get(packagesPath)
        .query(packagesQuery)
        .replyWithError('');
      expect(
        await getPkgReleases({
          datasource,
          packageName: 'hyper-expanse/library-release-workflows',
        }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get(packagesPath).query(packagesQuery).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          packageName: 'hyper-expanse/library-release-workflows',
        }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(baseUrl)
        .get(packagesPath)
        .query(packagesQuery)
        .reply(200, orbData);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hyper-expanse/library-release-workflows',
      });
      expect(res?.homepage).toBe(
        'https://circleci.com/developer/orbs/orb/hyper-expanse/library-release-workflows',
      );
      expect(res?.releases).toEqual([
        { version: '3.0.0', releaseTimestamp: '2018-12-11T05:28:14.080Z' },
        { version: '4.0.0', releaseTimestamp: '2018-12-11T17:41:26.595Z' },
        { version: '4.1.0', releaseTimestamp: '2018-12-11T18:14:41.116Z' },
        { version: '4.1.1' },
        { version: '4.1.2', releaseTimestamp: '2018-12-11T21:28:37.846Z' },
        { version: '4.1.3', releaseTimestamp: '2018-12-11T21:40:44.870Z' },
        { version: '4.1.4', releaseTimestamp: '2018-12-11T22:13:29.297Z' },
        { version: '4.1.5', releaseTimestamp: '2018-12-12T17:13:31.542Z' },
        { version: '4.1.6', releaseTimestamp: '2018-12-12T18:56:42.563Z' },
        { version: '4.2.0', releaseTimestamp: '2018-12-13T23:19:09.356Z' },
      ]);
    });

    it('processes home_url', async () => {
      const data: z.input<typeof OrbPackagesResponse> = {
        data: [
          {
            ...orbData.data[0],
            attributes: { home_url: 'https://google.com' },
          },
        ],
      };
      httpMock
        .scope(baseUrl)
        .get(packagesPath)
        .query(packagesQuery)
        .reply(200, data);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hyper-expanse/library-release-workflows',
      });
      expect(res?.homepage).toBe('https://google.com');
    });

    it('handles missing versions', async () => {
      const data = structuredClone(orbData);
      delete data.data[0].references;
      httpMock
        .scope(baseUrl)
        .get(packagesPath)
        .query(packagesQuery)
        .reply(200, data);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hyper-expanse/library-release-workflows',
      });
      expect(res?.releases).toEqual([]);
    });

    it('supports other registries', async () => {
      httpMock
        .scope('https://cci.internal.dev')
        .get(packagesPath)
        .query(packagesQuery)
        .reply(200, orbData);
      const res = await getPkgReleases({
        datasource,
        packageName: 'hyper-expanse/library-release-workflows',
        registryUrls: ['https://cci.internal.dev'],
      });
      expect(res?.registryUrl).toBe('https://cci.internal.dev');
    });
  });
});
